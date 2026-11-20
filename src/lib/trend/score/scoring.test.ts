import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  engagementRate, isAccelerating, outlierScore, recencyDecay, scoreItem, velocityPerHour,
} from './scoring';
import type { MetricSnapshot, TrendItem } from '../types';

const snap = (hoursAgo: number, views: number): MetricSnapshot => ({
  itemId: 'x',
  capturedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
  views, likes: 0, comments: 0,
});

test('outlier skoru küçük kanalı ödüllendirir', () => {
  const small = outlierScore(500_000, 3_000);
  const big = outlierScore(500_000, 2_000_000);
  assert.ok(small > big, 'aynı izlenme, küçük kanal daha yüksek skor almalı');
});

test('takipçi bilinmiyorsa taban payda kullanılır, patlamaz', () => {
  assert.equal(Number.isFinite(outlierScore(1000, null)), true);
  assert.equal(Number.isFinite(outlierScore(1000, 0)), true);
});

test('iki snapshot arasındaki gerçek hız hesaplanır', () => {
  const v = velocityPerHour([snap(10, 1000), snap(0, 3000)], new Date(Date.now() - 20 * 3_600_000).toISOString(), new Date());
  assert.ok(v !== null && Math.abs(v - 200) < 0.01); // 2000 izlenme / 10 saat
});

test('tek snapshot varsa yayından bu yana ortalamaya düşer', () => {
  const postedAt = new Date(Date.now() - 10 * 3_600_000).toISOString();
  const v = velocityPerHour([snap(0, 5000)], postedAt, new Date());
  assert.ok(v !== null && Math.abs(v - 500) < 1);
});

test('ivme en az 3 snapshot ister', () => {
  assert.equal(isAccelerating([snap(2, 100), snap(0, 200)]), null);
});

test('hızlanan video tespit edilir', () => {
  // 1. aralık: 1000/5sa = 200/sa · 2. aralık: 4000/5sa = 800/sa
  assert.equal(isAccelerating([snap(10, 1000), snap(5, 2000), snap(0, 6000)]), true);
});

test('yavaşlayan video hızlanıyor sayılmaz', () => {
  assert.equal(isAccelerating([snap(10, 1000), snap(5, 5000), snap(0, 5200)]), false);
});

test('sönüm eskiyi cezalandırır', () => {
  assert.ok(recencyDecay(0) === 1);
  assert.ok(recencyDecay(96) < 0.51 && recencyDecay(96) > 0.49);
  assert.ok(recencyDecay(200) < recencyDecay(96));
});

test('etkileşim oranı sıfır izlenmede patlamaz', () => {
  assert.equal(engagementRate(0, 10, 5), 0);
});

const item = (over: Partial<TrendItem> = {}): TrendItem => ({
  id: 'youtube:a', platform: 'youtube', nativeId: 'a', url: 'u', title: 't', caption: '',
  authorId: 'c', authorName: 'C', authorFollowers: 5000,
  postedAt: new Date(Date.now() - 24 * 3_600_000).toISOString(),
  durationSec: 30, hashtags: [], niche: 'volleyball', matchedQuery: 'q',
  firstSeenAt: new Date().toISOString(), ...over,
});

test('snapshot yoksa skorlanamaz', () => {
  assert.equal(scoreItem(item(), []), null);
});

test('küçük kanalın patlayan videosu büyük kanalın normalini geçer', () => {
  const underdog = scoreItem(item({ authorFollowers: 2_000 }), [snap(0, 400_000)])!;
  const giant = scoreItem(item({ authorFollowers: 3_000_000 }), [snap(0, 400_000)])!;
  assert.ok(underdog.score > giant.score);
});
