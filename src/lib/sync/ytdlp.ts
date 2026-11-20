import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DB } from '../db';
import { recordContentMetric } from '../repo/metrics';
import type { SyncSource } from './types';

const run = promisify(execFile);

export type VideoMeta = {
  id: string;
  title: string;
  platform: string;
  uploader: string | null;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  repost_count: number | null;
  duration: number | null;
};

type YtdlpJson = {
  id?: string; title?: string; extractor_key?: string; uploader?: string;
  view_count?: number | null; like_count?: number | null; comment_count?: number | null;
  repost_count?: number | null; duration?: number | null;
};

/** `yt-dlp -J` ile tek videonun meta verisi. Çerez tarayıcısı boşsa çerezsiz dener. */
export async function fetchVideoMeta(url: string, cookiesBrowser = process.env.YTDLP_COOKIES_BROWSER ?? ''): Promise<VideoMeta> {
  const args = ['-J', '--skip-download', '--no-warnings', '--no-playlist'];
  if (cookiesBrowser) args.push('--cookies-from-browser', cookiesBrowser);
  args.push(url);
  const { stdout } = await run('yt-dlp', args, { maxBuffer: 64 * 1024 * 1024, timeout: 120_000 });
  const j = JSON.parse(stdout) as YtdlpJson;
  if (!j.id) throw new Error(`${url}: yt-dlp id döndürmedi`);
  return {
    id: j.id,
    title: j.title ?? '',
    platform: (j.extractor_key ?? '').toLowerCase(),
    uploader: j.uploader ?? null,
    view_count: j.view_count ?? null,
    like_count: j.like_count ?? null,
    comment_count: j.comment_count ?? null,
    repost_count: j.repost_count ?? null,
    duration: j.duration ?? null,
  };
}

type Target = { id: number; published_url: string };

/** Instagram/TikTok içeriklerim: resmî API yok, yt-dlp + tarayıcı çerezi. */
export function createYtdlpSource(db: DB, cookiesBrowser: string, fetchMeta = fetchVideoMeta): SyncSource {
  return {
    name: 'ytdlp',
    isConfigured: () => true,
    async run() {
      const targets = db.prepare(`
        SELECT c.id, c.published_url FROM contents c JOIN channels ch ON ch.id = c.channel_id
        WHERE ch.platform IN ('instagram','tiktok') AND c.status IN ('published','measured') AND c.published_url IS NOT NULL
      `).all() as Target[];

      let written = 0;
      const errors: string[] = [];
      for (const t of targets) {
        try {
          const m = await fetchMeta(t.published_url, cookiesBrowser);
          if (m.view_count === null) {
            errors.push(`${t.published_url}: view_count yok`);
            continue;
          }
          const ok = recordContentMetric(db, {
            content_id: t.id,
            views: m.view_count,
            likes: m.like_count ?? 0,
            comments: m.comment_count ?? 0,
            shares: m.repost_count,
            source: 'ytdlp',
          });
          if (ok) written++;
        } catch (err) {
          errors.push(err instanceof Error ? err.message.split('\n').slice(-3).join(' ') : String(err));
        }
      }
      return { written, errors };
    },
  };
}
