import { nowIso, type DB } from '../db';
import type { ReportKind } from '../constants';
import type { ReportSave } from '../schemas';

export type Report = {
  id: number; kind: ReportKind; channel_id: number | null; period_start: string | null;
  period_end: string | null; title: string; body_md: string; created_at: string;
};

export function saveReport(db: DB, r: ReportSave): Report {
  const res = db.prepare(`
    INSERT INTO reports (kind, channel_id, period_start, period_end, title, body_md, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(r.kind, r.channel_id ?? null, r.period_start ?? null, r.period_end ?? null, r.title, r.body_md, nowIso());
  return getReport(db, Number(res.lastInsertRowid))!;
}

export function getReport(db: DB, id: number): Report | null {
  return (db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as Report | undefined) ?? null;
}

export function listReports(db: DB, opts: { kind?: ReportKind; limit?: number } = {}): Report[] {
  const sql = `SELECT * FROM reports ${opts.kind ? 'WHERE kind = @kind' : ''} ORDER BY created_at DESC LIMIT @limit`;
  return db.prepare(sql).all({ kind: opts.kind, limit: opts.limit ?? 50 }) as Report[];
}
