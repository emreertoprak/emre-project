import type { AppConfig } from '../config';
import type { DB } from '../db';
import { markMeasured } from '../repo/contents';
import { logRun } from '../repo/trends';
import { createYouTubeAnalyticsSource } from './youtube-analytics';
import { createYouTubePublicSource } from './youtube-public';
import { createYtdlpSource } from './ytdlp';
import type { SyncSource } from './types';

export function buildSyncSources(cfg: AppConfig, db: DB): SyncSource[] {
  return [
    createYouTubePublicSource(db, cfg.youtubeApiKey),
    createYouTubeAnalyticsSource(db, cfg.youtubeOauthClientId, cfg.youtubeOauthClientSecret),
    createYtdlpSource(db, cfg.ytdlpCookiesBrowser),
  ];
}

export type SyncSummary = {
  perSource: { source: string; written: number; errors: string[] }[];
  skipped: string[];
  measured: number;
};

/** Kaynakları sırayla çalıştırır; biri patlarsa diğerleri devam eder. Sonunda 48 saati geçenler `measured` olur. */
export async function syncAll(db: DB, sources: SyncSource[]): Promise<SyncSummary> {
  const summary: SyncSummary = { perSource: [], skipped: [], measured: 0 };
  for (const s of sources) {
    if (!s.isConfigured()) {
      summary.skipped.push(s.name);
      continue;
    }
    try {
      const r = await s.run();
      summary.perSource.push({ source: s.name, ...r });
      logRun(db, { collector: `sync:${s.name}`, niche: '*', found: r.written, error: r.errors.length ? r.errors.join(' | ') : undefined });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.perSource.push({ source: s.name, written: 0, errors: [msg] });
      logRun(db, { collector: `sync:${s.name}`, niche: '*', found: 0, error: msg });
    }
  }
  summary.measured = markMeasured(db);
  return summary;
}
