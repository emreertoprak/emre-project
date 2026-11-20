import { config as loadEnv } from 'dotenv';
import Database from 'better-sqlite3';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { CONTENT_STATUSES, REPORT_KINDS } from '../lib/constants';
import { db, DEFAULT_DB_PATH } from '../lib/db';
import { channelSummary } from '../lib/performance';
import * as s from '../lib/schemas';
import { listChannels, upsertChannel } from '../lib/repo/channels';
import { createContent, getContent, listContents, updateContent } from '../lib/repo/contents';
import { listCreatives, registerCreative } from '../lib/repo/creatives';
import { listExperiments, upsertExperiment } from '../lib/repo/experiments';
import { addExpensesFromStatement, expenseSummary, listCards } from '../lib/repo/finance';
import { contentMetricSeries, recordContentMetric } from '../lib/repo/metrics';
import { listNiches, upsertNiche } from '../lib/repo/niches';
import { listReports, saveReport } from '../lib/repo/reports';
import { addViralRef, listViralRefs, setViralAnalysis } from '../lib/repo/viral';
import { fetchVideoMeta } from '../lib/sync/ytdlp';
import { scoreAll } from '../lib/trend/pipeline';

loadEnv({ path: '.env.local', quiet: true });

const server = new McpServer({ name: 'creator', version: '0.1.0' });
const empty = z.object({});
const SQL_ROW_LIMIT = 200;

/** Ortak sarmalayıcı: sonucu JSON metin olarak döndürür, hatayı isError ile bildirir. stdout'a log yazılmaz. */
function tool<T extends z.ZodObject>(name: string, description: string, inputSchema: T, handler: (args: z.infer<T>) => unknown) {
  server.registerTool(name, { description, inputSchema }, (async (args: z.infer<T>) => {
    try {
      const result = await handler(args);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result ?? null) }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
  }) as never);
}

// ── Nişler ve kanallar ─────────────────────────────────────────────────
tool('niche_list', 'Tüm nişler (key, label, YouTube sorguları, subreddit\'ler, hashtag\'ler).', empty, () => listNiches(db()));
tool('niche_upsert', 'Niş ekler veya günceller. Trend taraması `queries` ile yapılır.', s.nicheUpsert, (a) => upsertNiche(db(), a));
tool('channel_list', 'Kanallar. Her kanal tek bir nişe aittir.', empty, () =>
  listChannels(db()).map(({ yt_refresh_token, ...c }) => ({ ...c, yt_analytics: yt_refresh_token !== null })));
tool('channel_upsert', 'Kanal ekler/günceller (platform+handle). Var olan kanalın nişi değiştirilemez — yeni niş için yeni kanal aç.',
  s.channelUpsert, (a) => {
    const { yt_refresh_token, ...c } = upsertChannel(db(), a);
    return { ...c, yt_analytics: yt_refresh_token !== null };
  });

// ── Trendler ve viral referanslar ──────────────────────────────────────
tool('trends_top', 'Bir niş için skorlanmış trend videolar (outlier = izlenme/takipçi, hız, ivme). Önce `pnpm collect` çalışmış olmalı.',
  z.object({ niche: z.string(), limit: z.number().int().positive().max(100).default(20) }),
  (a) => (scoreAll(db(), Number(process.env.LOOKBACK_HOURS ?? 168)).get(a.niche) ?? []).slice(0, a.limit));
tool('viral_ref_add', 'Viral referans kaydeder. `url` verilirse yt-dlp ile başlık/platform doldurulur (başarısız olursa yalnızca verilen alanlar).',
  s.viralRefAdd, async (a) => {
    let title = a.title;
    let platform: string | undefined;
    if (a.url && !title) {
      const meta = await fetchVideoMeta(a.url).catch(() => null);
      title = meta?.title;
      platform = meta?.platform || undefined;
    }
    return addViralRef(db(), { ...a, title, platform });
  });
tool('viral_ref_list', 'Viral referanslar (isteğe bağlı niş filtresi).', z.object({ niche_key: z.string().optional() }),
  (a) => listViralRefs(db(), a));
tool('viral_ref_set_analysis', 'Referansın çözümlemesini (hook türü, vuruşlar, tempo, CTA, neden tuttu) markdown olarak yazar.',
  s.viralRefAnalysis, (a) => setViralAnalysis(db(), a.id, a.analysis_md));

// ── İçerik hattı ───────────────────────────────────────────────────────
tool('content_create', 'Yeni içerik taslağı. Durum her zaman `draft`; onay yalnızca panelden.', s.contentCreate, (a) => createContent(db(), a));
tool('content_update', 'İçerik metnini günceller. Agent durumu yalnızca idea/draft yapabilir; onay/yayın panelden.',
  s.contentUpdate, ({ id, ...patch }) => updateContent(db(), id, patch, 'agent'));
tool('content_list', 'İçerikler (kanal/durum filtresi).',
  z.object({ channel_id: z.number().int().positive().optional(), status: z.enum(CONTENT_STATUSES).optional() }),
  (a) => listContents(db(), a));
tool('content_get', 'Tek içerik + metrik geçmişi + creative\'ler.', z.object({ id: z.number().int().positive() }), (a) => {
  const c = getContent(db(), a.id);
  if (!c) throw new Error(`İçerik yok: ${a.id}`);
  return { ...c, metrics: contentMetricSeries(db(), a.id), creatives: listCreatives(db(), { content_id: a.id }) };
});
tool('performance_summary', 'Kanal performansı: baseline (son 20 içerik medyanı), takipçi değişimi, içerik başına verdict (winner ≥1.5×, loser ≤0.5×, 48 saat altı pending).',
  z.object({ channel_id: z.number().int().positive(), days: z.number().int().positive().default(30) }),
  (a) => channelSummary(db(), a.channel_id, a.days));
tool('metrics_record', 'Elle metrik girişi (kaynak: manual).', s.metricsRecord,
  (a) => ({ written: recordContentMetric(db(), { ...a, source: 'manual' }, 0) }));

// ── Deneyler ve creative ───────────────────────────────────────────────
tool('experiment_upsert', 'Deney ekler/günceller (id varsa günceller). Sonuçlanınca status won/lost/inconclusive + verdict_md.',
  s.experimentUpsert, (a) => upsertExperiment(db(), a));
tool('experiment_list', 'Deneyler (kanal filtresi).', z.object({ channel_id: z.number().int().positive().optional() }),
  (a) => listExperiments(db(), a));
tool('creative_register', 'Üretilen görsel/video/thumbnail kaydı. file_path `creatives/<content_id>/...` altında olmalı veya remote_url verilmeli.',
  s.creativeRegister, (a) => registerCreative(db(), a));

// ── Finans ─────────────────────────────────────────────────────────────
tool('card_list', 'Kartlar (yalnızca banka, takma ad, son 4 hane, limit, kesim/son ödeme günü).', empty, () => listCards(db()));
tool('expense_add_many', 'Ekstre satırlarını tek seferde ekler; tekrar eden satırlar atlanır. `statement` verilirse ekstre kaydı açılır ve satırlar o karta bağlanır.',
  s.expenseAddMany, (a) => addExpensesFromStatement(db(), a));
tool('expense_summary', 'Aylık gider özeti: kategori ve kart bazında toplam.', z.object({ month: s.month }), (a) => expenseSummary(db(), a.month));

// ── Raporlar ve serbest sorgu ──────────────────────────────────────────
tool('report_save', 'Agent raporunu kaydeder (weekly, postmortem, algorithm, finance); panelde /raporlar altında görünür.',
  s.reportSave, (a) => saveReport(db(), a));
tool('report_list', 'Son raporlar.', z.object({ kind: z.enum(REPORT_KINDS).optional(), limit: z.number().int().positive().max(100).default(10) }),
  (a) => listReports(db(), a));
tool('sql_query', `Salt-okunur SQL (yalnızca SELECT/WITH, tek ifade, en çok ${SQL_ROW_LIMIT} satır). Tablolar: niches, channels, channel_metrics, contents, content_metrics, experiments, viral_refs, creatives, items, metric_snapshots, cards, statements, expenses, reports, runs.`,
  z.object({ sql: z.string() }), (a) => {
    if (!/^\s*(select|with)\b/i.test(a.sql) || a.sql.includes(';')) throw new Error('Yalnızca tek bir SELECT/WITH sorgusu çalıştırılabilir');
    const ro = new Database(DEFAULT_DB_PATH, { readonly: true, fileMustExist: true });
    try {
      const rows: unknown[] = [];
      const stmt = ro.prepare(a.sql);
      // OAuth refresh token agent'a/transkripte gitmesin: sonuç sütununun kaynağı (alias/CTE olsa da) izlenir.
      if (stmt.columns().some((c) => c.table === 'channels' && c.column === 'yt_refresh_token')) {
        throw new Error('channels.yt_refresh_token okunamaz; sütunları açıkça seç (ör. select id, handle from channels)');
      }
      for (const r of stmt.iterate()) {
        rows.push(r);
        if (rows.length >= SQL_ROW_LIMIT) break;
      }
      return rows;
    } finally {
      ro.close();
    }
  });

db(); // şema/migrasyon, ilk araç çağrısından önce
await server.connect(new StdioServerTransport());
