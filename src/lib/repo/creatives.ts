import { nowIso, type DB } from '../db';
import type { CreativeRegister } from '../schemas';

export type Creative = CreativeRegister & { id: number; created_at: string; file_path: string | null; remote_url: string | null };

export function registerCreative(db: DB, c: CreativeRegister): Creative {
  if (!c.file_path && !c.remote_url) throw new Error('file_path veya remote_url gerekli');
  const r = db.prepare(`
    INSERT INTO creatives (content_id, kind, purpose, tool, prompt, file_path, remote_url, aspect_ratio, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(c.content_id, c.kind, c.purpose, c.tool, c.prompt, c.file_path ?? null, c.remote_url ?? null, c.aspect_ratio, nowIso());
  return db.prepare('SELECT * FROM creatives WHERE id = ?').get(r.lastInsertRowid) as Creative;
}

export function listCreatives(db: DB, opts: { content_id?: number } = {}): Creative[] {
  const sql = `SELECT * FROM creatives ${opts.content_id ? 'WHERE content_id = @content_id' : ''} ORDER BY created_at DESC`;
  return db.prepare(sql).all(opts) as Creative[];
}
