import { z } from 'zod';
import {
  BANKS, CHANNEL_STATUSES, CONTENT_FORMATS, CONTENT_STATUSES, CREATIVE_KINDS, CREATIVE_PURPOSES,
  CREATIVE_TOOLS, EXPENSE_CATEGORIES, EXPERIMENT_STATUSES, PLATFORMS, REPORT_KINDS,
} from './constants';

/** MCP araçları ve Server Action'lar aynı şemaları kullanır. */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD olmalı');
const id = z.number().int().positive();

export const nicheUpsert = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/, 'küçük harf, rakam ve tire'),
  label: z.string().min(1),
  region_code: z.string().length(2).optional(),
  queries: z.array(z.string().min(1)).default([]),
  subreddits: z.array(z.string().min(1)).default([]),
  hashtags: z.array(z.string().min(1)).default([]),
});
export type NicheUpsert = z.infer<typeof nicheUpsert>;

export const channelUpsert = z.object({
  platform: z.enum(PLATFORMS),
  handle: z.string().min(1).transform((h) => h.replace(/^@/, '')),
  url: z.string().default(''),
  niche_key: z.string().min(1),
  status: z.enum(CHANNEL_STATUSES).optional(),
});
export type ChannelUpsert = z.infer<typeof channelUpsert>;

export const channelMetricManual = z.object({
  channel_id: id,
  followers: z.number().int().nonnegative(),
  total_views: z.number().int().nonnegative().optional(),
});

export const viralRefAdd = z.object({
  url: z.string().url().optional(),
  niche_key: z.string().min(1),
  title: z.string().optional(),
  transcript: z.string().optional(),
  notes: z.string().optional(),
  item_id: z.string().optional(),
});
export type ViralRefAdd = z.infer<typeof viralRefAdd>;

export const viralRefAnalysis = z.object({ id, analysis_md: z.string().min(1) });

export const contentCreate = z.object({
  channel_id: id,
  title: z.string().min(1),
  format: z.enum(CONTENT_FORMATS),
  hook: z.string().default(''),
  script_md: z.string().default(''),
  caption: z.string().default(''),
  hashtags: z.array(z.string()).default([]),
  viral_ref_id: id.optional(),
  parent_content_id: id.optional(),
  experiment_id: id.optional(),
});
export type ContentCreate = z.infer<typeof contentCreate>;

export const contentPatch = z.object({
  title: z.string().min(1).optional(),
  format: z.enum(CONTENT_FORMATS).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  hook: z.string().optional(),
  script_md: z.string().optional(),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  viral_ref_id: id.nullable().optional(),
  parent_content_id: id.nullable().optional(),
  experiment_id: id.nullable().optional(),
});
export type ContentPatch = z.infer<typeof contentPatch>;

export const contentUpdate = contentPatch.extend({ id });

export const contentPublish = z.object({
  id,
  published_url: z.string().url(),
  published_at: isoDate,
});

export const metricsRecord = z.object({
  content_id: id,
  views: z.number().int().nonnegative(),
  likes: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
  shares: z.number().int().nonnegative().optional(),
  saves: z.number().int().nonnegative().optional(),
});
export type MetricsRecord = z.infer<typeof metricsRecord>;

export const experimentUpsert = z.object({
  id: id.optional(),
  channel_id: id,
  hypothesis: z.string().min(1),
  variable: z.string().min(1),
  status: z.enum(EXPERIMENT_STATUSES).optional(),
  verdict_md: z.string().optional(),
});
export type ExperimentUpsert = z.infer<typeof experimentUpsert>;

export const creativeRegister = z.object({
  content_id: id,
  kind: z.enum(CREATIVE_KINDS),
  purpose: z.enum(CREATIVE_PURPOSES),
  tool: z.enum(CREATIVE_TOOLS),
  prompt: z.string().default(''),
  file_path: z.string().optional(),
  remote_url: z.string().url().optional(),
  aspect_ratio: z.string().regex(/^\d+:\d+$/),
});
export type CreativeRegister = z.infer<typeof creativeRegister>;

export const cardCreate = z.object({
  bank: z.enum(BANKS),
  nickname: z.string().min(1),
  last4: z.string().regex(/^\d{4}$/, 'yalnızca son 4 hane'),
  limit_try: z.number().nonnegative().optional(),
  statement_day: z.number().int().min(1).max(31).optional(),
  due_day: z.number().int().min(1).max(31).optional(),
});
export type CardCreate = z.infer<typeof cardCreate>;

export const expenseRow = z.object({
  occurred_on: isoDate,
  amount: z.number().refine((n) => n !== 0, 'tutar 0 olamaz'),
  merchant: z.string().min(1),
  category: z.enum(EXPENSE_CATEGORIES),
  card_id: id.optional(),
  channel_id: id.optional(),
  note: z.string().optional(),
});
export type ExpenseRow = z.infer<typeof expenseRow>;

export const statementInput = z.object({
  card_id: id,
  file_path: z.string().min(1),
  period_start: isoDate,
  period_end: isoDate,
  total: z.number(),
});
export type StatementInput = z.infer<typeof statementInput>;

export const expenseAddMany = z.object({
  statement: statementInput.optional(),
  rows: z.array(expenseRow).min(1),
});

export const month = z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM olmalı');

export const reportSave = z.object({
  kind: z.enum(REPORT_KINDS),
  channel_id: id.optional(),
  period_start: isoDate.optional(),
  period_end: isoDate.optional(),
  title: z.string().min(1),
  body_md: z.string().min(1),
});
export type ReportSave = z.infer<typeof reportSave>;
