import type { DB } from '../db';
import { listChannels, type Channel } from '../repo/channels';
import { recordContentMetric } from '../repo/metrics';
import type { SyncSource } from './types';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REPORTS_URL = 'https://youtubeanalytics.googleapis.com/v2/reports';
export const YT_ANALYTICS_SCOPE = 'https://www.googleapis.com/auth/yt-analytics.readonly';
const METRICS = ['views', 'likes', 'comments', 'shares', 'averageViewDuration', 'averageViewPercentage', 'subscribersGained'];

type ReportResponse = {
  columnHeaders?: { name: string }[];
  rows?: (string | number)[][];
};

export async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  const j = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !j.access_token) throw new Error(`OAuth yenileme: ${j.error ?? res.status} ${j.error_description ?? ''}`.trim());
  return j.access_token;
}

/** "Top videos" raporu: dimensions=video zorunlu, sort zorunlu, maxResults ≤ 200. */
async function topVideos(accessToken: string, startDate: string, endDate: string): Promise<Map<string, Record<string, number>>> {
  const url = `${REPORTS_URL}?${new URLSearchParams({
    ids: 'channel==MINE', startDate, endDate, dimensions: 'video', metrics: METRICS.join(','), sort: '-views', maxResults: '200',
  })}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`YouTube Analytics ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as ReportResponse;
  const names = (j.columnHeaders ?? []).map((h) => h.name);
  const out = new Map<string, Record<string, number>>();
  for (const row of j.rows ?? []) {
    const rec: Record<string, number> = {};
    names.forEach((n, i) => { if (n !== 'video') rec[n] = Number(row[i]); });
    out.set(String(row[names.indexOf('video')]), rec);
  }
  return out;
}

/** OAuth ile kanal sahibi metrikleri: izlenme süresi, izlenme yüzdesi, paylaşım, abone kazancı. */
export function createYouTubeAnalyticsSource(db: DB, clientId: string, clientSecret: string): SyncSource {
  const authorized = (): Channel[] => listChannels(db, { platform: 'youtube' }).filter((c) => c.yt_refresh_token && c.status !== 'retired');
  return {
    name: 'youtube_analytics',
    isConfigured: () => clientId.length > 0 && clientSecret.length > 0 && authorized().length > 0,
    async run() {
      let written = 0;
      const errors: string[] = [];
      const today = new Date().toISOString().slice(0, 10);

      for (const ch of authorized()) {
        try {
          const token = await refreshAccessToken(clientId, clientSecret, ch.yt_refresh_token!);
          const contents = db.prepare(`
            SELECT id, platform_post_id, published_at FROM contents
            WHERE channel_id = ? AND status IN ('published','measured') AND platform_post_id IS NOT NULL
          `).all(ch.id) as { id: number; platform_post_id: string; published_at: string | null }[];
          if (contents.length === 0) continue;

          // Ömür boyu toplam: en eski yayından bugüne.
          const start = contents.map((c) => c.published_at ?? ch.created_at).sort()[0]!.slice(0, 10);
          const report = await topVideos(token, start, today);
          for (const c of contents) {
            const r = report.get(c.platform_post_id);
            if (!r) continue;
            const ok = recordContentMetric(db, {
              content_id: c.id,
              views: r.views ?? 0,
              likes: r.likes ?? 0,
              comments: r.comments ?? 0,
              shares: r.shares ?? null,
              avg_view_duration_sec: r.averageViewDuration ?? null,
              avg_view_pct: r.averageViewPercentage ?? null,
              subs_gained: r.subscribersGained ?? null,
              source: 'youtube_analytics',
            });
            if (ok) written++;
          }
        } catch (err) {
          errors.push(`@${ch.handle}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      return { written, errors };
    },
  };
}
