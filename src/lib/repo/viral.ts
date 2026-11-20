import { nowIso, type DB } from '../db';

export type ViralRef = {
  id: number;
  url: string;
  platform: string;
  niche_key: string;
  title: string;
  transcript: string;
  notes: string;
  analysis_md: string;
  item_id: string | null;
  created_at: string;
};

export type ViralRefInsert = {
  url?: string; platform?: string; niche_key: string; title?: string;
  transcript?: string; notes?: string; item_id?: string;
};

export function platformFromUrl(url: string): string {
  if (/youtu\.?be/.test(url)) return 'youtube';
  if (/instagram\.com/.test(url)) return 'instagram';
  if (/tiktok\.com/.test(url)) return 'tiktok';
  if (/reddit\.com/.test(url)) return 'reddit';
  return '';
}

export function addViralRef(db: DB, v: ViralRefInsert): ViralRef {
  const r = db.prepare(`
    INSERT INTO viral_refs (url, platform, niche_key, title, transcript, notes, item_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    v.url ?? '', v.platform ?? (v.url ? platformFromUrl(v.url) : ''), v.niche_key, v.title ?? '',
    v.transcript ?? '', v.notes ?? '', v.item_id ?? null, nowIso(),
  );
  return getViralRef(db, Number(r.lastInsertRowid))!;
}

export function getViralRef(db: DB, id: number): ViralRef | null {
  return (db.prepare('SELECT * FROM viral_refs WHERE id = ?').get(id) as ViralRef | undefined) ?? null;
}

export function listViralRefs(db: DB, opts: { niche_key?: string } = {}): ViralRef[] {
  const sql = `SELECT * FROM viral_refs ${opts.niche_key ? 'WHERE niche_key = @niche_key' : ''} ORDER BY created_at DESC`;
  return db.prepare(sql).all(opts) as ViralRef[];
}

export function setViralAnalysis(db: DB, id: number, analysisMd: string): ViralRef {
  const r = db.prepare('UPDATE viral_refs SET analysis_md = ? WHERE id = ?').run(analysisMd, id);
  if (r.changes === 0) throw new Error(`Viral referans yok: ${id}`);
  return getViralRef(db, id)!;
}

/** Trend tablosundaki bir videoyu referansa alır (panel "Referansa al"). */
export function addViralRefFromItem(db: DB, itemId: string): ViralRef {
  const item = db.prepare('SELECT url, platform, niche, title, caption FROM items WHERE id = ?')
    .get(itemId) as { url: string; platform: string; niche: string; title: string; caption: string } | undefined;
  if (!item) throw new Error(`Trend öğesi yok: ${itemId}`);
  const existing = db.prepare('SELECT id FROM viral_refs WHERE item_id = ?').get(itemId) as { id: number } | undefined;
  if (existing) return getViralRef(db, existing.id)!;
  return addViralRef(db, {
    url: item.url, platform: item.platform, niche_key: item.niche, title: item.title, notes: item.caption, item_id: itemId,
  });
}
