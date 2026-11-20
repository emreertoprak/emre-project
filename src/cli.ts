import { config as loadEnv } from 'dotenv';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { loadConfig } from './lib/config';
import { db } from './lib/db';
import { getChannel, setYtRefreshToken } from './lib/repo/channels';
import { stats } from './lib/repo/trends';
import { buildSyncSources, syncAll } from './lib/sync';
import { YT_ANALYTICS_SCOPE } from './lib/sync/youtube-analytics';
import { collectAll } from './lib/trend/pipeline';

loadEnv({ path: '.env.local', quiet: true });

function log(msg: string): void { process.stdout.write(`${msg}\n`); }

async function cmdCollect(): Promise<void> {
  const cfg = loadConfig();
  if (cfg.niches.length === 0) {
    log('Niş yok — panelde /kanallar sayfasından niş ekle (veya brand-onboarding skill\'ini çalıştır).');
    return;
  }
  log(`→ ${cfg.niches.length} niş, son ${cfg.lookbackHours} saat taranıyor...`);
  const s = await collectAll(cfg, db());
  for (const r of s.perCollector) {
    const tag = r.error ? '✗' : '✓';
    log(`  ${tag} ${r.collector}/${r.niche}: ${r.found}${r.error ? ` — ${r.error}` : ''}`);
  }
  for (const name of s.skipped) log(`  – ${name}: atlandı (kimlik bilgisi yok)`);
  const st = stats(db());
  log(`\n${s.saved} kayıt işlendi. Veritabanı: ${st.items} trend içerik, ${st.snapshots} ölçüm.`);
}

async function cmdSync(): Promise<void> {
  const cfg = loadConfig();
  const s = await syncAll(db(), buildSyncSources(cfg, db()));
  for (const r of s.perSource) {
    log(`  ${r.errors.length ? '⚠' : '✓'} ${r.source}: ${r.written} ölçüm yazıldı`);
    for (const e of r.errors) log(`      ${e}`);
  }
  for (const name of s.skipped) log(`  – ${name}: atlandı (kimlik bilgisi/yetki yok)`);
  log(`\n${s.measured} içerik "measured" durumuna geçti.`);
}

function which(bin: string): string | null {
  try {
    return execFileSync(bin, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n')[0] ?? '';
  } catch {
    return null;
  }
}

function cmdHealth(): void {
  const cfg = loadConfig();
  const rows: [string, string, string][] = [];
  rows.push(['YOUTUBE_API_KEY', cfg.youtubeApiKey ? 'var' : 'YOK', cfg.youtubeApiKey ? '' : '.env.local içine ekle — trend + YouTube metrikleri için zorunlu']);
  const redditOk = cfg.redditClientId.length > 0 && cfg.redditClientSecret.length > 0;
  rows.push(['Reddit (OAuth)', redditOk ? 'var' : 'yok', redditOk ? '' : 'opsiyonel — reddit.com/prefs/apps > script app']);
  const oauthOk = cfg.youtubeOauthClientId.length > 0 && cfg.youtubeOauthClientSecret.length > 0;
  rows.push(['YouTube Analytics OAuth', oauthOk ? 'var' : 'yok', oauthOk ? 'kanal başına: pnpm yt-auth <kanal-id>' : 'opsiyonel — izlenme süresi/yüzdesi için']);
  rows.push(['YTDLP_COOKIES_BROWSER', cfg.ytdlpCookiesBrowser || 'yok', 'Instagram/TikTok metrikleri bu tarayıcının oturumuyla çekilir']);

  const ytdlp = which('yt-dlp');
  let ytdlpNote = ytdlp ? '' : 'kur: brew install yt-dlp';
  if (ytdlp) {
    const m = /^(\d{4})\.(\d{2})\.(\d{2})/.exec(ytdlp);
    if (m && Date.now() - Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) > 90 * 86_400_000) {
      ytdlpNote = '90 günden eski — yt-dlp -U çalıştır (platformlar sık bozuluyor)';
    }
  }
  rows.push(['yt-dlp', ytdlp ?? 'YOK', ytdlpNote]);
  rows.push(['higgsfield', which('higgsfield') ? 'var' : 'yok', 'AI görsel/video — creative-produce skill\'i kurulumu yönetir']);
  rows.push(['hyperframes', which('hyperframes') ?? 'yok', 'HTML→video']);

  rows.push(['Nişler', String(cfg.niches.length), cfg.niches.map((n) => n.key).join(', ')]);
  const counts = db().prepare(`
    SELECT (SELECT COUNT(*) FROM channels) channels, (SELECT COUNT(*) FROM contents) contents,
           (SELECT COUNT(*) FROM content_metrics) metrics, (SELECT COUNT(*) FROM items) trends,
           (SELECT COUNT(*) FROM expenses) expenses, (SELECT COUNT(*) FROM reports) reports
  `).get() as Record<string, number>;
  rows.push(['Veritabanı', `${counts.channels} kanal`, Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ')]);

  const w = Math.max(...rows.map((r) => r[0].length));
  for (const [k, v, note] of rows) log(`${k.padEnd(w)}  ${v.padEnd(12)} ${note}`);
  const quota = cfg.niches.reduce((a, n) => a + n.queries.length, 0) * 102;
  log(`\nTrend koşusu başına tahmini YouTube kotası: ~${quota} / 10.000 birim (günlük).`);
}

const REDIRECT_PORT = 8787;

/** Loopback OAuth: tarayıcıda izin ver → refresh token kanala yazılır. */
async function cmdYtAuth(channelIdArg: string | undefined): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.youtubeOauthClientId || !cfg.youtubeOauthClientSecret) {
    throw new Error('YOUTUBE_OAUTH_CLIENT_ID / YOUTUBE_OAUTH_CLIENT_SECRET .env.local içinde yok');
  }
  const channel = getChannel(db(), Number(channelIdArg));
  if (!channel || channel.platform !== 'youtube') throw new Error('Kullanım: pnpm yt-auth <YouTube kanalının panel id\'si>');

  const redirectUri = `http://127.0.0.1:${REDIRECT_PORT}/callback`;
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: cfg.youtubeOauthClientId, redirect_uri: redirectUri, response_type: 'code',
    scope: YT_ANALYTICS_SCOPE, access_type: 'offline', prompt: 'consent',
  })}`;

  const { promise: codePromise, resolve: resolveCode, reject } = Promise.withResolvers<string>();
  const server = createServer((req, res) => {
    const u = new URL(req.url ?? '/', redirectUri);
    if (u.pathname !== '/callback') { res.writeHead(404).end(); return; }
    const c = u.searchParams.get('code');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      .end(c ? 'Yetki alındı, bu sekmeyi kapatabilirsin.' : `Hata: ${u.searchParams.get('error')}`);
    server.close();
    if (c) resolveCode(c); else reject(new Error(`OAuth reddedildi: ${u.searchParams.get('error')}`));
  });
  server.listen(REDIRECT_PORT, '127.0.0.1', () => log(`Tarayıcıda aç ve @${channel.handle} kanalının Google hesabıyla izin ver:\n\n${authUrl}\n`));
  const code = await codePromise;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: cfg.youtubeOauthClientId, client_secret: cfg.youtubeOauthClientSecret,
      redirect_uri: redirectUri, grant_type: 'authorization_code',
    }),
  });
  const j = (await res.json()) as { refresh_token?: string; error?: string; error_description?: string };
  if (!j.refresh_token) throw new Error(`Refresh token alınamadı: ${j.error ?? res.status} ${j.error_description ?? ''}`);
  setYtRefreshToken(db(), channel.id, j.refresh_token);
  log(`✓ @${channel.handle} için YouTube Analytics yetkisi kaydedildi. Şimdi: pnpm sync`);
}

const [, , cmd, arg] = process.argv;

const run = async (): Promise<void> => {
  switch (cmd) {
    case 'collect': return cmdCollect();
    case 'sync': return cmdSync();
    case 'health': return cmdHealth();
    case 'yt-auth': return cmdYtAuth(arg);
    default:
      log('Kullanım: pnpm <collect|sync|health|yt-auth <kanal-id>>');
      process.exitCode = 1;
  }
};

run().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
