import type { AppConfig } from '../config';
import type { Collector, ScoredItem } from './types';
import { createYouTubeCollector } from './collectors/youtube';
import { createRedditCollector } from './collectors/reddit';
import type { DB } from '../db';
import { loadRecent, logRun, saveResults } from '../repo/trends';
import { rank, scoreItem } from './score/scoring';

export function buildCollectors(cfg: AppConfig): Collector[] {
  return [
    createYouTubeCollector({
      apiKey: cfg.youtubeApiKey,
      lookbackHours: cfg.lookbackHours,
      perQuery: cfg.perQuery,
    }),
    createRedditCollector({
      clientId: cfg.redditClientId,
      clientSecret: cfg.redditClientSecret,
      timeframe: 'week',
      perSubreddit: 25,
    }),
  ];
}

export type CollectOptions = {
  /** Testte zamanı ilerletmek için. */
  capturedAt?: string;
};

export type CollectSummary = {
  saved: number;
  perCollector: { collector: string; niche: string; found: number; error?: string }[];
  skipped: string[];
};

/**
 * Tüm kaynakları tüm nişler için gezer. Bir kaynak patlarsa diğerleri devam eder.
 * `collectors` testte sahte kaynak enjekte etmek için dışarıdan verilebilir.
 */
export async function collectAll(
  cfg: AppConfig,
  db: DB,
  collectors: Collector[] = buildCollectors(cfg),
  opts: CollectOptions = {},
): Promise<CollectSummary> {
  const summary: CollectSummary = { saved: 0, perCollector: [], skipped: [] };

  for (const collector of collectors) {
    if (!collector.isConfigured()) {
      summary.skipped.push(collector.name);
      continue;
    }

    for (const niche of cfg.niches) {
      try {
        const results = await collector.collect(niche);
        const saved = saveResults(db, results, { capturedAt: opts.capturedAt });
        summary.saved += saved;
        summary.perCollector.push({ collector: collector.name, niche: niche.key, found: saved });
        logRun(db, { collector: collector.name, niche: niche.key, found: saved });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        summary.perCollector.push({ collector: collector.name, niche: niche.key, found: 0, error: msg });
        logRun(db, { collector: collector.name, niche: niche.key, found: 0, error: msg });
      }
    }
  }

  return summary;
}

export function scoreAll(db: DB, lookbackHours: number): Map<string, ScoredItem[]> {
  const byNiche = new Map<string, ScoredItem[]>();
  for (const { item, snapshots } of loadRecent(db, lookbackHours)) {
    const scored = scoreItem(item, snapshots);
    if (!scored) continue;
    const bucket = byNiche.get(item.niche) ?? [];
    bucket.push(scored);
    byNiche.set(item.niche, bucket);
  }
  for (const [k, v] of byNiche) byNiche.set(k, rank(v));
  return byNiche;
}
