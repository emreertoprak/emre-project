import type { MetricSnapshot, ScoredItem, TrendItem } from '../types';

/** Skor ağırlıkları — tek yerde, deneyerek oynayabilirsin. */
export const WEIGHTS = {
  outlier: 3.0,
  velocity: 2.0,
  acceleration: 1.5,
  engagement: 1.0,
  /** Skorun yarıya düştüğü yaş (saat). Trend penceresi ~4 gün. */
  halfLifeHours: 96,
  /** Takipçisi bilinmeyen/çok küçük kanallarda payda tabanı. */
  followerFloor: 500,
} as const;

export const HOUR_MS = 3_600_000;

export function ageHours(postedAt: string, now: Date): number {
  return Math.max(0, (now.getTime() - new Date(postedAt).getTime()) / HOUR_MS);
}

/**
 * Kanalına göre sıra dışılık. 3k takipçilinin 500k'sı ile 2M takipçilinin
 * 500k'sı aynı şey değil — sıralamayı belirleyen asıl sinyal bu.
 */
export function outlierScore(views: number, followers: number | null): number {
  const denom = Math.max(followers ?? 0, WEIGHTS.followerFloor);
  return views / denom;
}

/**
 * Saatlik izlenme. İki snapshot varsa aradaki gerçek fark kullanılır;
 * yoksa yayından bu yana ortalamaya düşülür (daha zayıf sinyal).
 */
export function velocityPerHour(snapshots: MetricSnapshot[], postedAt: string, now: Date): number | null {
  const last = snapshots.at(-1);
  if (!last) return null;

  const first = snapshots[0];
  if (first && snapshots.length >= 2 && first !== last) {
    const dtH = (new Date(last.capturedAt).getTime() - new Date(first.capturedAt).getTime()) / HOUR_MS;
    if (dtH >= 0.5) return Math.max(0, (last.views - first.views) / dtH);
  }

  const age = ageHours(postedAt, now);
  return age >= 1 ? last.views / age : null;
}

/**
 * Hızlanıyor mu? Son iki aralığın hızını karşılaştırır.
 * En az 3 snapshot gerekir; öncesinde null (bilinmiyor).
 */
export function isAccelerating(snapshots: MetricSnapshot[]): boolean | null {
  if (snapshots.length < 3) return null;
  const [a, b, c] = [snapshots.at(-3), snapshots.at(-2), snapshots.at(-1)];
  if (!a || !b || !c) return null;

  const rate = (x: MetricSnapshot, y: MetricSnapshot): number | null => {
    const dtH = (new Date(y.capturedAt).getTime() - new Date(x.capturedAt).getTime()) / HOUR_MS;
    return dtH >= 0.5 ? (y.views - x.views) / dtH : null;
  };

  const prev = rate(a, b);
  const curr = rate(b, c);
  if (prev === null || curr === null || prev <= 0) return null;
  return curr > prev * 1.1; // %10 eşik — gürültüyü ele
}

export function engagementRate(views: number, likes: number, comments: number): number {
  return views > 0 ? (likes + comments) / views : 0;
}

/** Yaşa göre üstel sönüm; taze olan kazanır. */
export function recencyDecay(age: number, halfLife = WEIGHTS.halfLifeHours): number {
  return Math.pow(0.5, age / halfLife);
}

export function scoreItem(
  item: TrendItem,
  snapshots: MetricSnapshot[],
  now = new Date(),
): ScoredItem | null {
  const last = snapshots.at(-1);
  if (!last) return null;

  const age = ageHours(item.postedAt, now);
  const outlier = outlierScore(last.views, item.authorFollowers);
  const velocity = velocityPerHour(snapshots, item.postedAt, now);
  const accel = isAccelerating(snapshots);
  const engagement = engagementRate(last.views, last.likes, last.comments);

  const base =
    WEIGHTS.outlier * Math.log10(1 + outlier) +
    WEIGHTS.velocity * Math.log10(1 + (velocity ?? 0)) +
    WEIGHTS.acceleration * (accel === true ? 1 : 0) +
    WEIGHTS.engagement * Math.min(engagement * 20, 2);

  return {
    ...item,
    views: last.views,
    likes: last.likes,
    comments: last.comments,
    outlierScore: outlier,
    velocityPerHour: velocity,
    accelerating: accel,
    engagementRate: engagement,
    ageHours: age,
    score: base * recencyDecay(age),
    snapshotCount: snapshots.length,
  };
}

export function rank(items: ScoredItem[]): ScoredItem[] {
  return [...items].sort((a, b) => b.score - a.score);
}
