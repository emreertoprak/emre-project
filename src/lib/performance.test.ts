import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { baseline, channelSummary, verdict } from './performance';
import { openDb } from './db';
import { upsertNiche } from './repo/niches';
import { upsertChannel } from './repo/channels';
import { createContent, publishContent } from './repo/contents';
import { recordContentMetric } from './repo/metrics';

test('5 içerikten azında baseline yok, verdict pending', () => {
  assert.equal(baseline([100, 200, 300, 400]), null);
  assert.equal(verdict(10_000, baseline([100, 200, 300, 400]), 500), 'pending');
});

test('baseline medyandır — tek patlayan video normali bozmaz', () => {
  assert.equal(baseline([900, 1000, 1100, 1000, 1_000_000]), 1000);
  assert.equal(baseline([800, 900, 1100, 1200, 1000, 1000]), 1000);
});

test('baseline 1000 iken eşikler: 1.5× winner, 0.5× loser, arası average', () => {
  assert.equal(verdict(1500, 1000, 72), 'winner');
  assert.equal(verdict(500, 1000, 72), 'loser');
  assert.equal(verdict(1499, 1000, 72), 'average');
  assert.equal(verdict(501, 1000, 72), 'average');
});

test('48 saatten genç içerik yargılanmaz', () => {
  assert.equal(verdict(100_000, 1000, 47), 'pending');
  assert.equal(verdict(100_000, 1000, 48), 'winner');
});

test('kanal özeti: kazanan, kaybeden ve ölçümsüz içerik doğru etiketlenir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'perf-'));
  const db = openDb(join(dir, 't.db'));
  try {
    upsertNiche(db, { key: 'fit', label: 'Fitness', queries: [], subreddits: [], hashtags: [] });
    const ch = upsertChannel(db, { platform: 'youtube', handle: 'me', url: '', niche_key: 'fit' });
    const now = new Date('2026-11-20T12:00:00Z');
    const views = [1000, 1000, 1000, 1000, 1000, 3000, 200];
    const ids = views.map((v, i) => {
      const c = createContent(db, { channel_id: ch.id, title: `v${i}`, format: 'short', hook: '', script_md: '', caption: '', hashtags: [] });
      publishContent(db, { id: c.id, published_url: `https://youtu.be/x${i}`, published_at: '2026-11-10', platform_post_id: null });
      recordContentMetric(db, { content_id: c.id, views: v, likes: 0, comments: 0, source: 'manual' });
      return c.id;
    });
    const unmeasured = createContent(db, { channel_id: ch.id, title: 'ölçümsüz', format: 'short', hook: '', script_md: '', caption: '', hashtags: [] });
    publishContent(db, { id: unmeasured.id, published_url: 'https://youtu.be/y', published_at: '2026-11-10', platform_post_id: null });

    const s = channelSummary(db, ch.id, 30, now);
    assert.equal(s.baseline, 1000);
    const byId = new Map(s.contents.map((c) => [c.id, c.verdict]));
    assert.equal(byId.get(ids[5]!), 'winner');
    assert.equal(byId.get(ids[6]!), 'loser');
    assert.equal(byId.get(ids[0]!), 'average');
    assert.equal(byId.get(unmeasured.id), 'pending');
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
