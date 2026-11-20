import { nowIso, type DB } from '../db';
import type { NicheUpsert } from '../schemas';
import type { NicheConfig } from '../trend/types';

type NicheRow = {
  key: string; label: string; region_code: string | null;
  queries: string; subreddits: string; hashtags: string; created_at: string;
};

function toNiche(r: NicheRow): NicheConfig {
  return {
    key: r.key,
    label: r.label,
    regionCode: r.region_code ?? undefined,
    queries: JSON.parse(r.queries) as string[],
    subreddits: JSON.parse(r.subreddits) as string[],
    hashtags: JSON.parse(r.hashtags) as string[],
  };
}

export function listNiches(db: DB): NicheConfig[] {
  return (db.prepare('SELECT * FROM niches ORDER BY label').all() as NicheRow[]).map(toNiche);
}

export function getNiche(db: DB, key: string): NicheConfig | null {
  const r = db.prepare('SELECT * FROM niches WHERE key = ?').get(key) as NicheRow | undefined;
  return r ? toNiche(r) : null;
}

export function upsertNiche(db: DB, n: NicheUpsert): NicheConfig {
  db.prepare(`
    INSERT INTO niches (key, label, region_code, queries, subreddits, hashtags, created_at)
    VALUES (@key, @label, @region_code, @queries, @subreddits, @hashtags, @created_at)
    ON CONFLICT(key) DO UPDATE SET
      label = excluded.label, region_code = excluded.region_code, queries = excluded.queries,
      subreddits = excluded.subreddits, hashtags = excluded.hashtags
  `).run({
    key: n.key,
    label: n.label,
    region_code: n.region_code ?? null,
    queries: JSON.stringify(n.queries),
    subreddits: JSON.stringify(n.subreddits),
    hashtags: JSON.stringify(n.hashtags),
    created_at: nowIso(),
  });
  return getNiche(db, n.key)!;
}
