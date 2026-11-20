import type { Collector, CollectorResult, NicheConfig, TrendItem } from '../types';

export const API = 'https://www.googleapis.com/youtube/v3';

/** Shorts sayılacak üst sınır. YouTube API'de doğrudan "Shorts" filtresi yok. */
const MAX_SHORT_SEC = 185;

type SearchResponse = { items?: { id?: { videoId?: string } }[] };
type VideoResponse = {
  items?: {
    id: string;
    snippet: {
      title: string; description: string; channelId: string;
      channelTitle: string; publishedAt: string; tags?: string[];
    };
    statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
    contentDetails: { duration: string };
  }[];
};
type ChannelResponse = {
  items?: { id: string; statistics: { subscriberCount?: string } }[];
};

/** "PT1M30S" -> 90. Ayrıştıramazsa null. */
export function parseIsoDuration(iso: string): number | null {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(iso);
  if (!m) return null;
  const [, h, min, s] = m;
  return Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0);
}

export function extractHashtags(...texts: string[]): string[] {
  const found = new Set<string>();
  for (const t of texts) {
    for (const m of t.matchAll(/#([\p{L}\p{N}_]{2,40})/gu)) {
      const tag = m[1];
      if (tag) found.add(tag.toLowerCase());
    }
  }
  return [...found].slice(0, 25);
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // Kota bitti / anahtar geçersiz gibi durumlarda net mesaj ver.
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export type YouTubeOptions = {
  apiKey: string;
  /** Kaç saat geriye bakılsın. */
  lookbackHours: number;
  /** Sorgu başına kaç sonuç (max 50). Her sorgu 100 kota birimi yakar. */
  perQuery: number;
};

export function createYouTubeCollector(opts: YouTubeOptions): Collector {
  return {
    name: 'youtube',
    isConfigured: () => opts.apiKey.length > 0,

    async collect(niche: NicheConfig): Promise<CollectorResult[]> {
      const publishedAfter = new Date(Date.now() - opts.lookbackHours * 3_600_000).toISOString();
      const now = new Date().toISOString();
      const byId = new Map<string, { videoId: string; query: string }>();

      // 1) Arama — her sorgu 100 kota birimi.
      for (const q of niche.queries) {
        const url =
          `${API}/search?part=snippet&type=video&videoDuration=short&order=viewCount` +
          `&publishedAfter=${encodeURIComponent(publishedAfter)}` +
          `&maxResults=${Math.min(opts.perQuery, 50)}` +
          `&q=${encodeURIComponent(q)}` +
          (niche.regionCode ? `&regionCode=${niche.regionCode}` : '') +
          `&key=${opts.apiKey}`;

        const data = await getJson<SearchResponse>(url);
        for (const it of data.items ?? []) {
          const vid = it.id?.videoId;
          if (vid && !byId.has(vid)) byId.set(vid, { videoId: vid, query: q });
        }
      }

      if (byId.size === 0) return [];

      // 2) Detay + istatistik — 50'lik gruplar, grup başına 1 birim.
      const videos: NonNullable<VideoResponse['items']> = [];
      for (const ids of chunk([...byId.keys()], 50)) {
        const url = `${API}/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${opts.apiKey}`;
        const data = await getJson<VideoResponse>(url);
        videos.push(...(data.items ?? []));
      }

      // 3) Kanal takipçileri — outlier skorunun paydası.
      const channelIds = [...new Set(videos.map((v) => v.snippet.channelId))];
      const subs = new Map<string, number | null>();
      for (const ids of chunk(channelIds, 50)) {
        const url = `${API}/channels?part=statistics&id=${ids.join(',')}&key=${opts.apiKey}`;
        const data = await getJson<ChannelResponse>(url);
        for (const c of data.items ?? []) {
          const raw = c.statistics.subscriberCount;
          subs.set(c.id, raw === undefined ? null : Number(raw));
        }
      }

      const results: CollectorResult[] = [];
      for (const v of videos) {
        const durationSec = parseIsoDuration(v.contentDetails.duration);
        // Uzun videoları ele — Shorts formatı peşindeyiz.
        if (durationSec !== null && durationSec > MAX_SHORT_SEC) continue;

        const item: TrendItem = {
          id: `youtube:${v.id}`,
          platform: 'youtube',
          nativeId: v.id,
          url: `https://www.youtube.com/watch?v=${v.id}`,
          title: v.snippet.title,
          caption: v.snippet.description.slice(0, 1000),
          authorId: v.snippet.channelId,
          authorName: v.snippet.channelTitle,
          authorFollowers: subs.get(v.snippet.channelId) ?? null,
          postedAt: v.snippet.publishedAt,
          durationSec,
          hashtags: extractHashtags(v.snippet.title, v.snippet.description),
          niche: niche.key,
          matchedQuery: byId.get(v.id)?.query ?? '',
          firstSeenAt: now,
        };

        results.push({
          item,
          metrics: {
            views: Number(v.statistics.viewCount ?? 0),
            likes: Number(v.statistics.likeCount ?? 0),
            comments: Number(v.statistics.commentCount ?? 0),
          },
        });
      }

      return results;
    },
  };
}
