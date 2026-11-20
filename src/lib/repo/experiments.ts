import { nowIso, type DB } from '../db';
import type { ExperimentStatus } from '../constants';
import type { ExperimentUpsert } from '../schemas';

export type Experiment = {
  id: number;
  channel_id: number;
  hypothesis: string;
  variable: string;
  status: ExperimentStatus;
  verdict_md: string;
  started_at: string;
  ended_at: string | null;
};

export function getExperiment(db: DB, id: number): Experiment | null {
  return (db.prepare('SELECT * FROM experiments WHERE id = ?').get(id) as Experiment | undefined) ?? null;
}

export function listExperiments(db: DB, opts: { channel_id?: number } = {}): Experiment[] {
  const sql = `SELECT * FROM experiments ${opts.channel_id ? 'WHERE channel_id = @channel_id' : ''} ORDER BY started_at DESC`;
  return db.prepare(sql).all(opts) as Experiment[];
}

/** `id` varsa günceller; durum `running` dışına çıkınca `ended_at` damgalanır. */
export function upsertExperiment(db: DB, e: ExperimentUpsert): Experiment {
  if (e.id) {
    const cur = getExperiment(db, e.id);
    if (!cur) throw new Error(`Deney yok: ${e.id}`);
    const status = e.status ?? cur.status;
    const endedAt = status === 'running' ? null : (cur.ended_at ?? nowIso());
    db.prepare(`
      UPDATE experiments SET hypothesis = ?, variable = ?, status = ?, verdict_md = ?, ended_at = ? WHERE id = ?
    `).run(e.hypothesis, e.variable, status, e.verdict_md ?? cur.verdict_md, endedAt, e.id);
    return getExperiment(db, e.id)!;
  }
  const r = db.prepare(`
    INSERT INTO experiments (channel_id, hypothesis, variable, status, verdict_md, started_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(e.channel_id, e.hypothesis, e.variable, e.status ?? 'running', e.verdict_md ?? '', nowIso());
  return getExperiment(db, Number(r.lastInsertRowid))!;
}

/** Deneye bağlı içerikler (panel). */
export function experimentContents(db: DB, experimentId: number): { id: number; title: string; status: string }[] {
  return db.prepare('SELECT id, title, status FROM contents WHERE experiment_id = ? ORDER BY created_at')
    .all(experimentId) as { id: number; title: string; status: string }[];
}
