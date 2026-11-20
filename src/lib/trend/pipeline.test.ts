import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectAll, scoreAll } from './pipeline';
import { openDb } from '../db';
import { loadRecent, stats } from '../repo/trends';
import type { AppConfig } from '../config';
import type { Collector, CollectorResult, NicheConfig } from './types';

const niche: NicheConfig = {
  key: 'volleyball', label: 'Voleybol', queries: ['q'], subreddits: [], hashtags: [],
};

const cfg: AppConfig = {
  youtubeApiKey: '', redditClientId: '', redditClientSecret: '',
  youtubeOauthClientId: '', youtubeOauthClientSecret: '', ytdlpCookiesBrowser: '',
  niches: [niche], lookbackHours: 168, perQuery: 10,
};

function tmpDb() {
  const dir = mkdtempSync(join(tmpdir(), 'cr-test-'));
  const db = openDb(join(dir, 'test.db'));
  return { db, cleanup: () => { db.close(); rmSync(dir, { recursive: true, force: true }); } };
}

function fakeResult(id: string, views: number, hoursAgo = 24): CollectorResult {
  return {
    item: {
      id: `youtube:${id}`, platform: 'youtube', nativeId: id,
      url: `https://youtube.com/watch?v=${id}`, title: `Video ${id}`, caption: '',
      authorId: `ch-${id}`, authorName: 'Kanal', authorFollowers: 5_000,
      postedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
      durationSec: 30, hashtags: ['voleybol'], niche: 'volleyball',
      matchedQuery: 'q', firstSeenAt: new Date().toISOString(),
    },
    metrics: { views, likes: Math.round(views * 0.05), comments: Math.round(views * 0.002) },
  };
}

function stubCollector(results: CollectorResult[], over: Partial<Collector> = {}): Collector {
  return {
    name: 'stub',
    isConfigured: () => true,
    collect: async () => results,
    ...over,
  };
}

test('toplama → kaydetme → skorlama zinciri uçtan uca çalışır', async () => {
  const { db, cleanup } = tmpDb();
  try {
    const summary = await collectAll(cfg, db, [stubCollector([fakeResult('a', 100_000), fakeResult('b', 2_000)])]);
    assert.equal(summary.saved, 2);

    const byNiche = scoreAll(db, 168);
    const items = byNiche.get('volleyball');
    assert.equal(items?.length, 2);
    // Daha çok izlenen (aynı takipçi sayısıyla) üstte olmalı.
    assert.equal(items?.[0]?.nativeId, 'a');
  } finally { cleanup(); }
});

test('aynı video farklı zamanlarda toplanınca tek satır, iki ölçüm olur', async () => {
  const { db, cleanup } = tmpDb();
  try {
    const t0 = new Date(Date.now() - 6 * 3_600_000).toISOString();
    const t1 = new Date().toISOString();

    await collectAll(cfg, db, [stubCollector([fakeResult('a', 1_000)])], { capturedAt: t0 });
    await collectAll(cfg, db, [stubCollector([fakeResult('a', 5_000)])], { capturedAt: t1 });

    const st = stats(db);
    assert.equal(st.items, 1, 'item tekilleşmeli');
    assert.equal(st.snapshots, 2, 'her koşu yeni ölçüm bırakmalı');

    const [row] = loadRecent(db, 168);
    assert.equal(row?.snapshots.length, 2);
    assert.equal(row?.snapshots.at(-1)?.views, 5_000);
  } finally { cleanup(); }
});

test('arka arkaya koşu ikinci ölçüm yazmaz — hız hesabı çöpe dönmesin', async () => {
  const { db, cleanup } = tmpDb();
  try {
    await collectAll(cfg, db, [stubCollector([fakeResult('a', 1_000)])]);
    await collectAll(cfg, db, [stubCollector([fakeResult('a', 1_010)])]);

    assert.equal(stats(db).snapshots, 1, '30 dakikadan yakın ölçüm atlanmalı');
  } finally { cleanup(); }
});

test('iki ölçümden gerçek saatlik hız türetilir', async () => {
  const { db, cleanup } = tmpDb();
  try {
    const t0 = new Date(Date.now() - 10 * 3_600_000).toISOString();
    await collectAll(cfg, db, [stubCollector([fakeResult('a', 1_000)])], { capturedAt: t0 });
    await collectAll(cfg, db, [stubCollector([fakeResult('a', 3_000)])]);

    const scored = scoreAll(db, 168).get('volleyball')?.[0];
    // 2000 izlenme / 10 saat = 200/sa
    assert.ok(scored?.velocityPerHour !== null && scored !== undefined);
    assert.ok(Math.abs(scored.velocityPerHour! - 200) < 1);
  } finally { cleanup(); }
});

test('bir kaynak patlarsa diğerleri devam eder', async () => {
  const { db, cleanup } = tmpDb();
  try {
    const broken = stubCollector([], { name: 'broken', collect: async () => { throw new Error('API 500'); } });
    const working = stubCollector([fakeResult('ok', 9_000)]);

    const summary = await collectAll(cfg, db, [broken, working]);

    assert.equal(summary.saved, 1);
    assert.ok(summary.perCollector.some((r) => r.error?.includes('API 500')));
    assert.equal(stats(db).items, 1);
  } finally { cleanup(); }
});

test('kimlik bilgisi olmayan kaynak atlanır, hata sayılmaz', async () => {
  const { db, cleanup } = tmpDb();
  try {
    const unconfigured = stubCollector([], { name: 'nokey', isConfigured: () => false });
    const summary = await collectAll(cfg, db, [unconfigured]);

    assert.deepEqual(summary.skipped, ['nokey']);
    assert.equal(summary.perCollector.length, 0);
  } finally { cleanup(); }
});

test('lookback penceresi dışındaki içerik skorlamaya girmez', async () => {
  const { db, cleanup } = tmpDb();
  try {
    await collectAll(cfg, db, [stubCollector([
      fakeResult('fresh', 1_000, 10),
      fakeResult('old', 1_000, 24 * 40),
    ])]);

    const items = scoreAll(db, 168).get('volleyball') ?? [];
    assert.equal(items.length, 1);
    assert.equal(items[0]?.nativeId, 'fresh');
  } finally { cleanup(); }
});
