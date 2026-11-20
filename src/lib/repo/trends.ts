import type { DB } from '../db';
import type { CollectorResult, MetricSnapshot, TrendItem } from '../trend/types';

/** items satırının ham hali (snake_case). */
type ItemRow = {
  id: string; platform: string; native_id: string; url: string; title: string;
  caption: string; author_id: string; author_name: string;
  author_followers: number | null; posted_at: string; duration_sec: number | null;
  hashtags: string; niche: string; matched_query: string; first_seen_at: string;
};

function toItem(r: ItemRow): TrendItem {
  return {
    id: r.id,
    platform: r.platform as TrendItem['platform'],
    nativeId: r.native_id,
    url: r.url,
    title: r.title,
    caption: r.caption,
    authorId: r.author_id,
    authorName: r.author_name,
    authorFollowers: r.author_followers,
    postedAt: r.posted_at,
    durationSec: r.duration_sec,
    hashtags: JSON.parse(r.hashtags) as string[],
    niche: r.niche,
    matchedQuery: r.matched_query,
    firstSeenAt: r.first_seen_at,
  };
}

export type SaveOptions = {
  capturedAt?: string;
  /**
   * İki ölçüm arasındaki asgari boşluk. Arka arkaya koşularda hem birincil
   * anahtar çakışır hem de hız hesabı anlamsızlaşır (5 saniyede "izlenme/saat"
   * ölçülemez), o yüzden bu süreden yakın ölçümler yazılmaz.
   */
  minIntervalMinutes?: number;
};

/**
 * Item'ı ekler (varsa takipçi/başlık gibi değişebilen alanları günceller) ve
 * o anki metriği yeni bir snapshot olarak yazar.
 *
 * @returns işlenen item sayısı
 */
export function saveResults(db: DB, results: CollectorResult[], opts: SaveOptions = {}): number {
  const capturedAt = opts.capturedAt ?? new Date().toISOString();
  const minGapMs = (opts.minIntervalMinutes ?? 30) * 60_000;
  const upsertItem = db.prepare(`
    INSERT INTO items (id, platform, native_id, url, title, caption, author_id, author_name,
                       author_followers, posted_at, duration_sec, hashtags, niche, matched_query, first_seen_at)
    VALUES (@id, @platform, @native_id, @url, @title, @caption, @author_id, @author_name,
            @author_followers, @posted_at, @duration_sec, @hashtags, @niche, @matched_query, @first_seen_at)
    ON CONFLICT(id) DO UPDATE SET
      title            = excluded.title,
      caption          = excluded.caption,
      author_followers = COALESCE(excluded.author_followers, items.author_followers),
      duration_sec     = COALESCE(excluded.duration_sec, items.duration_sec)
  `);

  const insertSnap = db.prepare(`
    INSERT OR REPLACE INTO metric_snapshots (item_id, captured_at, views, likes, comments)
    VALUES (?, ?, ?, ?, ?)
  `);

  const lastSnap = db.prepare(
    `SELECT captured_at FROM metric_snapshots WHERE item_id = ? ORDER BY captured_at DESC LIMIT 1`,
  );

  const tx = db.transaction((rows: CollectorResult[]) => {
    for (const { item, metrics } of rows) {
      upsertItem.run({
        id: item.id,
        platform: item.platform,
        native_id: item.nativeId,
        url: item.url,
        title: item.title,
        caption: item.caption.slice(0, 2000),
        author_id: item.authorId,
        author_name: item.authorName,
        author_followers: item.authorFollowers,
        posted_at: item.postedAt,
        duration_sec: item.durationSec,
        hashtags: JSON.stringify(item.hashtags),
        niche: item.niche,
        matched_query: item.matchedQuery,
        first_seen_at: item.firstSeenAt,
      });
      const prev = lastSnap.get(item.id) as { captured_at: string } | undefined;
      const tooSoon =
        prev !== undefined &&
        new Date(capturedAt).getTime() - new Date(prev.captured_at).getTime() < minGapMs;

      if (!tooSoon) {
        insertSnap.run(item.id, capturedAt, metrics.views, metrics.likes, metrics.comments);
      }
    }
  });

  tx(results);
  return results.length;
}

export function logRun(
  db: DB,
  entry: { collector: string; niche: string; found: number; error?: string },
): void {
  db.prepare(`INSERT INTO runs (started_at, collector, niche, found, error) VALUES (?, ?, ?, ?, ?)`)
    .run(new Date().toISOString(), entry.collector, entry.niche, entry.found, entry.error ?? null);
}

export type ItemWithSnapshots = { item: TrendItem; snapshots: MetricSnapshot[] };

/** Son `sinceHours` içinde yayımlanmış item'ları tüm snapshot'larıyla getirir. */
export function loadRecent(db: DB, sinceHours: number, niche?: string): ItemWithSnapshots[] {
  const cutoff = new Date(Date.now() - sinceHours * 3_600_000).toISOString();
  const rows = niche
    ? db.prepare(`SELECT * FROM items WHERE posted_at >= ? AND niche = ?`).all(cutoff, niche) as ItemRow[]
    : db.prepare(`SELECT * FROM items WHERE posted_at >= ?`).all(cutoff) as ItemRow[];

  const snapStmt = db.prepare(
    `SELECT item_id, captured_at, views, likes, comments FROM metric_snapshots
     WHERE item_id = ? ORDER BY captured_at ASC`,
  );

  return rows.map((r) => {
    const raw = snapStmt.all(r.id) as {
      item_id: string; captured_at: string; views: number; likes: number; comments: number;
    }[];
    return {
      item: toItem(r),
      snapshots: raw.map((s) => ({
        itemId: s.item_id, capturedAt: s.captured_at,
        views: s.views, likes: s.likes, comments: s.comments,
      })),
    };
  });
}

export function markSurfaced(db: DB, itemIds: string[]): void {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO surfaced (item_id, surfaced_at) VALUES (?, ?)`,
  );
  const now = new Date().toISOString();
  const tx = db.transaction((ids: string[]) => { for (const id of ids) stmt.run(id, now); });
  tx(itemIds);
}

export function surfacedIds(db: DB): Set<string> {
  const rows = db.prepare(`SELECT item_id FROM surfaced`).all() as { item_id: string }[];
  return new Set(rows.map((r) => r.item_id));
}

export function stats(db: DB): { items: number; snapshots: number; niches: number } {
  const one = <T>(sql: string): T => db.prepare(sql).get() as T;
  return {
    items: one<{ c: number }>(`SELECT COUNT(*) AS c FROM items`).c,
    snapshots: one<{ c: number }>(`SELECT COUNT(*) AS c FROM metric_snapshots`).c,
    niches: one<{ c: number }>(`SELECT COUNT(DISTINCT niche) AS c FROM items`).c,
  };
}
