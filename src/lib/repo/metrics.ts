import { nowIso, type DB } from '../db';
import type { MetricSource } from '../constants';

export type ContentMetric = {
  content_id: number;
  captured_at: string;
  views: number;
  likes: number;
  comments: number;
  shares: number | null;
  saves: number | null;
  avg_view_duration_sec: number | null;
  avg_view_pct: number | null;
  subs_gained: number | null;
  source: MetricSource;
};

export type ContentMetricInput = Omit<ContentMetric, 'captured_at' | 'shares' | 'saves' | 'avg_view_duration_sec' | 'avg_view_pct' | 'subs_gained'>
  & Partial<Pick<ContentMetric, 'captured_at' | 'shares' | 'saves' | 'avg_view_duration_sec' | 'avg_view_pct' | 'subs_gained'>>;

/**
 * Aynı kaynaktan 30 dakikadan yakın ikinci ölçüm yazılmaz (Trend Radar kuralı):
 * arka arkaya koşularda hız hesabı anlamsızlaşır. Yazıldıysa true.
 */
export function recordContentMetric(db: DB, m: ContentMetricInput, minIntervalMinutes = 30): boolean {
  const capturedAt = m.captured_at ?? nowIso();
  const last = db.prepare(`
    SELECT captured_at FROM content_metrics WHERE content_id = ? AND source = ? ORDER BY captured_at DESC LIMIT 1
  `).get(m.content_id, m.source) as { captured_at: string } | undefined;
  if (last && Date.parse(capturedAt) - Date.parse(last.captured_at) < minIntervalMinutes * 60_000) return false;

  db.prepare(`
    INSERT INTO content_metrics (content_id, captured_at, views, likes, comments, shares, saves,
                                 avg_view_duration_sec, avg_view_pct, subs_gained, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    m.content_id, capturedAt, m.views, m.likes, m.comments, m.shares ?? null, m.saves ?? null,
    m.avg_view_duration_sec ?? null, m.avg_view_pct ?? null, m.subs_gained ?? null, m.source,
  );
  return true;
}

export function contentMetricSeries(db: DB, contentId: number): ContentMetric[] {
  return db.prepare('SELECT * FROM content_metrics WHERE content_id = ? ORDER BY captured_at')
    .all(contentId) as ContentMetric[];
}

export type LatestMetric = {
  views: number;
  likes: number;
  comments: number;
  avgViewPct: number | null;
};

/**
 * Kaynaklar arası tek görünüm: izlenme monoton arttığından en yüksek izlenmeli satır
 * esas alınır (Analytics birkaç gün geriden gelir); izlenme yüzdesi Analytics'in son satırından.
 */
export function latestMetric(series: ContentMetric[]): LatestMetric | null {
  if (series.length === 0) return null;
  const top = series.reduce((a, b) => (b.views > a.views || (b.views === a.views && b.captured_at > a.captured_at) ? b : a));
  const withPct = series.filter((s) => s.avg_view_pct !== null).at(-1);
  return { views: top.views, likes: top.likes, comments: top.comments, avgViewPct: withPct?.avg_view_pct ?? null };
}
