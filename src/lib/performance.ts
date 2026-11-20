import type { DB } from './db';
import type { ContentFormat, Verdict } from './constants';
import { channelMetricSeries, latestChannelMetric } from './repo/channels';
import { contentMetricSeries, latestMetric } from './repo/metrics';
import { engagementRate } from './trend/score/scoring';

/** "Tutan içerik" tanımı — dene-yanıl döngüsünün tek ölçütü. */
export const PERF = {
  baselineWindow: 20,
  minContentsForBaseline: 5,
  winnerRatio: 1.5,
  loserRatio: 0.5,
  minAgeHours: 48,
} as const;

/** Son N içeriğin izlenme medyanı; az veriyle "normal" ilan etmeyiz. */
export function baseline(views: number[]): number | null {
  if (views.length < PERF.minContentsForBaseline) return null;
  const s = [...views].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function verdict(views: number, base: number | null, ageHours: number): Verdict {
  if (ageHours < PERF.minAgeHours || base === null) return 'pending';
  if (views >= PERF.winnerRatio * base) return 'winner';
  if (views <= PERF.loserRatio * base) return 'loser';
  return 'average';
}

export type ContentPerformance = {
  id: number;
  title: string;
  format: ContentFormat;
  hook: string;
  published_at: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  engagementRate: number | null;
  avgViewPct: number | null;
  verdict: Verdict;
  parent_content_id: number | null;
  experiment_id: number | null;
};

export type ChannelSummary = {
  channel_id: number;
  baseline: number | null;
  followersNow: number | null;
  followersDelta: number | null;
  contents: ContentPerformance[];
};

type PublishedRow = {
  id: number; title: string; format: ContentFormat; hook: string; published_at: string;
  parent_content_id: number | null; experiment_id: number | null;
};

export function channelSummary(db: DB, channelId: number, days = 30, now = new Date()): ChannelSummary {
  const published = db.prepare(`
    SELECT id, title, format, hook, published_at, parent_content_id, experiment_id FROM contents
    WHERE channel_id = ? AND status IN ('published','measured') AND published_at IS NOT NULL
    ORDER BY published_at DESC
  `).all(channelId) as PublishedRow[];

  const withMetrics = published.map((c) => ({ c, m: latestMetric(contentMetricSeries(db, c.id)) }));
  const base = baseline(
    withMetrics.filter((x) => x.m !== null).slice(0, PERF.baselineWindow).map((x) => x.m!.views),
  );

  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const contents = withMetrics
    .filter(({ c }) => c.published_at >= since.slice(0, 10))
    .map(({ c, m }): ContentPerformance => {
      const age = (now.getTime() - Date.parse(c.published_at)) / 3_600_000;
      return {
        ...c,
        views: m?.views ?? null,
        likes: m?.likes ?? null,
        comments: m?.comments ?? null,
        engagementRate: m ? engagementRate(m.views, m.likes, m.comments) : null,
        avgViewPct: m?.avgViewPct ?? null,
        verdict: m ? verdict(m.views, base, age) : 'pending',
      };
    });

  const latest = latestChannelMetric(db, channelId);
  const first = channelMetricSeries(db, channelId, since)[0];
  return {
    channel_id: channelId,
    baseline: base,
    followersNow: latest?.followers ?? null,
    followersDelta: latest && first ? latest.followers - first.followers : null,
    contents,
  };
}
