import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractHashtags, parseIsoDuration } from './youtube';

test('ISO 8601 süre saniyeye çevrilir', () => {
  assert.equal(parseIsoDuration('PT30S'), 30);
  assert.equal(parseIsoDuration('PT1M30S'), 90);
  assert.equal(parseIsoDuration('PT1H2M3S'), 3723);
  assert.equal(parseIsoDuration('PT3M'), 180);
});

test('bozuk süre null döner, patlamaz', () => {
  assert.equal(parseIsoDuration('garbage'), null);
});

test('hashtag çıkarımı Türkçe karakterleri tutar', () => {
  const tags = extractHashtags('Voleybol antrenmanı #voleybol #smaç', 'ekstra #Fitness');
  assert.deepEqual(tags.sort(), ['fitness', 'smaç', 'voleybol']);
});

test('hashtag tekrarları teklenir (harf farkı gözetmeden)', () => {
  assert.deepEqual(extractHashtags('#gym #gym #GYM'), ['gym']);
});

test('tek karakterli hashtag gürültü sayılır, elenir', () => {
  assert.deepEqual(extractHashtags('#a #1'), []);
});
