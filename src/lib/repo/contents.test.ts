import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, type DB } from '../db';
import { upsertNiche } from './niches';
import { upsertChannel } from './channels';
import { AGENT_STATUS_ERROR, createContent, updateContent, youtubeIdFromUrl } from './contents';

function withDb(fn: (db: DB, channelId: number) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'contents-'));
  const db = openDb(join(dir, 't.db'));
  try {
    upsertNiche(db, { key: 'fit', label: 'Fitness', queries: [], subreddits: [], hashtags: [] });
    fn(db, upsertChannel(db, { platform: 'tiktok', handle: 'me', url: '', niche_key: 'fit' }).id);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

const draft = (channel_id: number) => ({
  channel_id, title: 't', format: 'short' as const, hook: 'h', script_md: '', caption: '', hashtags: [],
});

test('agent içeriği onaylayamaz; kullanıcı onaylayabilir', () => {
  withDb((db, ch) => {
    const c = createContent(db, draft(ch));
    assert.equal(c.status, 'draft');
    assert.throws(() => updateContent(db, c.id, { status: 'approved' }, 'agent'), { message: AGENT_STATUS_ERROR });
    assert.equal(updateContent(db, c.id, { status: 'approved' }, 'user').status, 'approved');
  });
});

test('onaylanmış içeriği agent ne geri çekebilir ne de metnini değiştirebilir', () => {
  withDb((db, ch) => {
    const c = createContent(db, draft(ch));
    assert.equal(updateContent(db, c.id, { hook: 'taslakta düzeltme' }, 'agent').hook, 'taslakta düzeltme');
    updateContent(db, c.id, { status: 'approved' }, 'user');
    assert.throws(() => updateContent(db, c.id, { status: 'draft' }, 'agent'), { message: AGENT_STATUS_ERROR });
    assert.throws(() => updateContent(db, c.id, { hook: 'yeni hook' }, 'agent'), { message: AGENT_STATUS_ERROR });
    assert.equal(updateContent(db, c.id, { hook: 'kullanıcı düzeltmesi' }, 'user').hook, 'kullanıcı düzeltmesi');
  });
});

test('bir kanalın nişi değiştirilemez', () => {
  withDb((db) => {
    upsertNiche(db, { key: 'tech', label: 'Teknoloji', queries: [], subreddits: [], hashtags: [] });
    assert.throws(() => upsertChannel(db, { platform: 'tiktok', handle: 'me', url: '', niche_key: 'tech' }), /niş değiştirilemez/);
  });
});

test('YouTube id üç URL biçiminden çıkarılır', () => {
  assert.equal(youtubeIdFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1'), 'dQw4w9WgXcQ');
  assert.equal(youtubeIdFromUrl('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeIdFromUrl('https://youtube.com/shorts/sHpEqeSByPI'), 'sHpEqeSByPI');
  assert.equal(youtubeIdFromUrl('https://www.tiktok.com/@a/video/1'), null);
});
