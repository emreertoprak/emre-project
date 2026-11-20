import { nowIso, type DB } from '../db';
import type { ChannelPlatform, ChannelStatus } from '../constants';
import type { ChannelUpsert } from '../schemas';

export type Channel = {
  id: number;
  platform: ChannelPlatform;
  handle: string;
  url: string;
  niche_key: string;
  native_id: string | null;
  status: ChannelStatus;
  yt_refresh_token: string | null;
  created_at: string;
};

export type ChannelMetric = {
  id: number; channel_id: number; captured_at: string; followers: number;
  total_views: number | null; video_count: number | null; source: string;
};

export function listChannels(db: DB, opts: { platform?: ChannelPlatform; status?: ChannelStatus } = {}): Channel[] {
  const where: string[] = [];
  if (opts.platform) where.push('platform = @platform');
  if (opts.status) where.push('status = @status');
  const sql = `SELECT * FROM channels ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY niche_key, platform, handle`;
  return db.prepare(sql).all(opts) as Channel[];
}

export function getChannel(db: DB, id: number): Channel | null {
  return (db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as Channel | undefined) ?? null;
}

/**
 * (platform, handle) üzerinden ekler/günceller. Bir kanal tek nişe aittir:
 * var olan kanalın nişini değiştirme isteği reddedilir — yeni niş = yeni kanal.
 */
export function upsertChannel(db: DB, c: ChannelUpsert): Channel {
  const existing = db.prepare('SELECT * FROM channels WHERE platform = ? AND handle = ?')
    .get(c.platform, c.handle) as Channel | undefined;

  if (!db.prepare('SELECT 1 FROM niches WHERE key = ?').get(c.niche_key)) {
    throw new Error(`Niş yok: ${c.niche_key}`);
  }

  if (existing) {
    if (existing.niche_key !== c.niche_key) {
      throw new Error(
        `@${c.handle} kanalı "${existing.niche_key}" nişine ait; niş değiştirilemez — "${c.niche_key}" için yeni kanal aç`,
      );
    }
    db.prepare('UPDATE channels SET url = ?, status = ? WHERE id = ?')
      .run(c.url || existing.url, c.status ?? existing.status, existing.id);
    return getChannel(db, existing.id)!;
  }

  const r = db.prepare(`
    INSERT INTO channels (platform, handle, url, niche_key, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(c.platform, c.handle, c.url, c.niche_key, c.status ?? 'active', nowIso());
  return getChannel(db, Number(r.lastInsertRowid))!;
}

export function updateChannel(db: DB, id: number, patch: { url?: string; status?: ChannelStatus }): void {
  const ch = getChannel(db, id);
  if (!ch) throw new Error(`Kanal yok: ${id}`);
  db.prepare('UPDATE channels SET url = ?, status = ? WHERE id = ?')
    .run(patch.url ?? ch.url, patch.status ?? ch.status, id);
}

export function setChannelNativeId(db: DB, id: number, nativeId: string): void {
  db.prepare('UPDATE channels SET native_id = ? WHERE id = ?').run(nativeId, id);
}

export function setYtRefreshToken(db: DB, id: number, token: string): void {
  db.prepare('UPDATE channels SET yt_refresh_token = ? WHERE id = ?').run(token, id);
}

export function recordChannelMetric(
  db: DB,
  m: { channel_id: number; followers: number; total_views?: number | null; video_count?: number | null; source: string; captured_at?: string },
): void {
  db.prepare(`
    INSERT INTO channel_metrics (channel_id, captured_at, followers, total_views, video_count, source)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(m.channel_id, m.captured_at ?? nowIso(), m.followers, m.total_views ?? null, m.video_count ?? null, m.source);
}

export function channelMetricSeries(db: DB, channelId: number, sinceIso?: string): ChannelMetric[] {
  return db.prepare(`
    SELECT * FROM channel_metrics WHERE channel_id = ? AND captured_at >= ? ORDER BY captured_at
  `).all(channelId, sinceIso ?? '') as ChannelMetric[];
}

export function latestChannelMetric(db: DB, channelId: number): ChannelMetric | null {
  return (db.prepare('SELECT * FROM channel_metrics WHERE channel_id = ? ORDER BY captured_at DESC LIMIT 1')
    .get(channelId) as ChannelMetric | undefined) ?? null;
}
