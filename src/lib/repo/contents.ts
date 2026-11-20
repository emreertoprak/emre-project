import { nowIso, type DB } from '../db';
import { AGENT_STATUSES, type ContentFormat, type ContentStatus } from '../constants';
import type { ContentCreate, ContentPatch } from '../schemas';

export type Content = {
  id: number;
  channel_id: number;
  title: string;
  format: ContentFormat;
  status: ContentStatus;
  hook: string;
  script_md: string;
  caption: string;
  hashtags: string[];
  viral_ref_id: number | null;
  parent_content_id: number | null;
  experiment_id: number | null;
  published_url: string | null;
  platform_post_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type ContentRow = Omit<Content, 'hashtags'> & { hashtags: string };

export type Actor = 'user' | 'agent';

export const AGENT_STATUS_ERROR = 'Onay ve yayın durumu yalnızca panelden değiştirilir';

function toContent(r: ContentRow): Content {
  return { ...r, hashtags: JSON.parse(r.hashtags) as string[] };
}

export function getContent(db: DB, id: number): Content | null {
  const r = db.prepare('SELECT * FROM contents WHERE id = ?').get(id) as ContentRow | undefined;
  return r ? toContent(r) : null;
}

export function listContents(db: DB, opts: { channel_id?: number; status?: ContentStatus } = {}): Content[] {
  const where: string[] = [];
  if (opts.channel_id) where.push('channel_id = @channel_id');
  if (opts.status) where.push('status = @status');
  const sql = `SELECT * FROM contents ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY updated_at DESC`;
  return (db.prepare(sql).all(opts) as ContentRow[]).map(toContent);
}

/** Her yeni içerik taslak olarak doğar; onay panelden verilir. */
export function createContent(db: DB, c: ContentCreate): Content {
  const now = nowIso();
  const r = db.prepare(`
    INSERT INTO contents (channel_id, title, format, status, hook, script_md, caption, hashtags,
                          viral_ref_id, parent_content_id, experiment_id, created_at, updated_at)
    VALUES (@channel_id, @title, @format, 'draft', @hook, @script_md, @caption, @hashtags,
            @viral_ref_id, @parent_content_id, @experiment_id, @now, @now)
  `).run({
    channel_id: c.channel_id,
    title: c.title,
    format: c.format,
    hook: c.hook,
    script_md: c.script_md,
    caption: c.caption,
    hashtags: JSON.stringify(c.hashtags),
    viral_ref_id: c.viral_ref_id ?? null,
    parent_content_id: c.parent_content_id ?? null,
    experiment_id: c.experiment_id ?? null,
    now,
  });
  return getContent(db, Number(r.lastInsertRowid))!;
}

/**
 * Onay kapısının tek noktası: agent yalnızca `idea`/`draft` atayabilir.
 * approved/produced/published/measured yalnızca kullanıcıdan (panel) gelir.
 */
export function updateContent(db: DB, id: number, patch: ContentPatch, actor: Actor): Content {
  const current = getContent(db, id);
  if (!current) throw new Error(`İçerik yok: ${id}`);
  // Agent yalnızca fikir/taslak üzerinde çalışır; onaylanmış içeriğin metni de değiştirilemez.
  if (actor === 'agent' && !AGENT_STATUSES.includes(current.status)) throw new Error(AGENT_STATUS_ERROR);
  if (actor === 'agent' && patch.status !== undefined && !AGENT_STATUSES.includes(patch.status)) {
    throw new Error(AGENT_STATUS_ERROR);
  }

  const next = { ...current, ...patch };
  db.prepare(`
    UPDATE contents SET title = @title, format = @format, status = @status, hook = @hook,
      script_md = @script_md, caption = @caption, hashtags = @hashtags, viral_ref_id = @viral_ref_id,
      parent_content_id = @parent_content_id, experiment_id = @experiment_id, updated_at = @updated_at
    WHERE id = @id
  `).run({
    id,
    title: next.title,
    format: next.format,
    status: next.status,
    hook: next.hook,
    script_md: next.script_md,
    caption: next.caption,
    hashtags: JSON.stringify(next.hashtags),
    viral_ref_id: next.viral_ref_id ?? null,
    parent_content_id: next.parent_content_id ?? null,
    experiment_id: next.experiment_id ?? null,
    updated_at: nowIso(),
  });
  return getContent(db, id)!;
}

/** Paneldeki "Yayınlandı" düğmesi. `platformPostId` metrik eşleştirmesinde kullanılır. */
export function publishContent(
  db: DB,
  p: { id: number; published_url: string; published_at: string; platform_post_id: string | null },
): Content {
  updateContent(db, p.id, { status: 'published' }, 'user');
  db.prepare('UPDATE contents SET published_url = ?, published_at = ?, platform_post_id = ? WHERE id = ?')
    .run(p.published_url, p.published_at, p.platform_post_id, p.id);
  return getContent(db, p.id)!;
}

/** Yayınlanmış, en az bir ölçümü olan ve yaşı ≥ `minAgeHours` içerikleri `measured` yapar. */
export function markMeasured(db: DB, minAgeHours = 48, now = new Date()): number {
  const cutoff = new Date(now.getTime() - minAgeHours * 3_600_000).toISOString();
  return db.prepare(`
    UPDATE contents SET status = 'measured', updated_at = ?
    WHERE status = 'published' AND published_at IS NOT NULL AND published_at <= ?
      AND EXISTS (SELECT 1 FROM content_metrics m WHERE m.content_id = contents.id)
  `).run(now.toISOString(), cutoff).changes;
}

/** YouTube URL'sinden video id: watch?v=, youtu.be/, /shorts/. */
export function youtubeIdFromUrl(url: string): string | null {
  const m = /(?:[?&]v=|youtu\.be\/|\/shorts\/)([\w-]{11})/.exec(url);
  return m?.[1] ?? null;
}
