import type { DB } from '../db';
import { listChannels, recordChannelMetric, setChannelNativeId } from '../repo/channels';
import { recordContentMetric } from '../repo/metrics';
import { API, chunk, getJson } from '../trend/collectors/youtube';
import type { SyncSource } from './types';

type ChannelsResponse = {
  items?: { id: string; statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string } }[];
};
type VideosResponse = {
  items?: { id: string; statistics: { viewCount?: string; likeCount?: string; commentCount?: string } }[];
};

/** API anahtarıyla herkese açık sayılar: kanal abone/izlenme ve video izlenme/beğeni/yorum. */
export function createYouTubePublicSource(db: DB, apiKey: string): SyncSource {
  return {
    name: 'youtube_api',
    isConfigured: () => apiKey.length > 0,
    async run() {
      let written = 0;
      const errors: string[] = [];

      for (const ch of listChannels(db, { platform: 'youtube' })) {
        if (ch.status === 'retired') continue;
        try {
          const q = ch.native_id ? `id=${ch.native_id}` : `forHandle=${encodeURIComponent(`@${ch.handle}`)}`;
          const res = await getJson<ChannelsResponse>(`${API}/channels?part=id,statistics&${q}&key=${apiKey}`);
          const item = res.items?.[0];
          if (!item) {
            errors.push(`@${ch.handle}: YouTube kanalı bulunamadı`);
            continue;
          }
          if (!ch.native_id) setChannelNativeId(db, ch.id, item.id);
          recordChannelMetric(db, {
            channel_id: ch.id,
            followers: Number(item.statistics.subscriberCount ?? 0),
            total_views: item.statistics.viewCount ? Number(item.statistics.viewCount) : null,
            video_count: item.statistics.videoCount ? Number(item.statistics.videoCount) : null,
            source: 'youtube_api',
          });
          written++;
        } catch (err) {
          errors.push(`@${ch.handle}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const videos = db.prepare(`
        SELECT c.id, c.platform_post_id FROM contents c JOIN channels ch ON ch.id = c.channel_id
        WHERE ch.platform = 'youtube' AND c.status IN ('published','measured') AND c.platform_post_id IS NOT NULL
      `).all() as { id: number; platform_post_id: string }[];
      const byVideo = new Map(videos.map((v) => [v.platform_post_id, v.id]));

      for (const ids of chunk([...byVideo.keys()], 50)) {
        try {
          const res = await getJson<VideosResponse>(`${API}/videos?part=statistics&id=${ids.join(',')}&key=${apiKey}`);
          for (const v of res.items ?? []) {
            const contentId = byVideo.get(v.id);
            if (!contentId) continue;
            const ok = recordContentMetric(db, {
              content_id: contentId,
              views: Number(v.statistics.viewCount ?? 0),
              likes: Number(v.statistics.likeCount ?? 0),
              comments: Number(v.statistics.commentCount ?? 0),
              source: 'youtube_api',
            });
            if (ok) written++;
          }
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }
      return { written, errors };
    },
  };
}
