/** Şemadaki CHECK listelerinin TS karşılıkları. Değiştirirsen `db.ts` CHECK'lerini de değiştir. */

export const PLATFORMS = ['youtube', 'instagram', 'tiktok'] as const;
export type ChannelPlatform = (typeof PLATFORMS)[number];

export const CHANNEL_STATUSES = ['active', 'paused', 'retired'] as const;
export type ChannelStatus = (typeof CHANNEL_STATUSES)[number];

export const CONTENT_FORMATS = ['short', 'long', 'reel', 'carousel', 'post', 'story'] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export const CONTENT_STATUSES = ['idea', 'draft', 'approved', 'produced', 'published', 'measured'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
/** Agent'ın (MCP) atayabileceği durumlar. Geri kalanı yalnızca panelden. */
export const AGENT_STATUSES: readonly ContentStatus[] = ['idea', 'draft'];

export const METRIC_SOURCES = ['youtube_api', 'youtube_analytics', 'ytdlp', 'manual'] as const;
export type MetricSource = (typeof METRIC_SOURCES)[number];

export const EXPERIMENT_STATUSES = ['running', 'won', 'lost', 'inconclusive'] as const;
export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];

export const CREATIVE_KINDS = ['image', 'video', 'thumbnail'] as const;
export const CREATIVE_PURPOSES = ['organic', 'ad'] as const;
export const CREATIVE_TOOLS = ['higgsfield', 'hyperframes', 'manual'] as const;

export const BANKS = ['yapikredi', 'enpara', 'other'] as const;
export type Bank = (typeof BANKS)[number];

export const EXPENSE_SOURCES = ['manual', 'statement'] as const;
export type ExpenseSource = (typeof EXPENSE_SOURCES)[number];

export const EXPENSE_CATEGORIES = [
  'ekipman', 'yazilim-abonelik', 'reklam', 'uretim', 'egitim', 'market',
  'fatura', 'ulasim', 'yeme-icme', 'kisisel', 'diger',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const REPORT_KINDS = ['weekly', 'postmortem', 'algorithm', 'finance'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const VERDICTS = ['winner', 'average', 'loser', 'pending'] as const;
export type Verdict = (typeof VERDICTS)[number];
