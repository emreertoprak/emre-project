import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, type DB } from '../db';
import { addExpense, addExpensesFromStatement, createCard, currentPeriodSpend, expenseSummary } from './finance';

function withDb(fn: (db: DB) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'fin-'));
  const db = openDb(join(dir, 't.db'));
  try { fn(db); } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
}

const row = { occurred_on: '2026-11-03', amount: 249.9, merchant: 'Adobe ', category: 'yazilim-abonelik' as const };

test('aynı ekstre iki kez içe aktarılınca satırlar çoğalmaz', () => {
  withDb((db) => {
    const card = createCard(db, { bank: 'yapikredi', nickname: 'World', last4: '1234' });
    const stmt = { card_id: card.id, file_path: 'inbox/statements/x.pdf', period_start: '2026-10-15', period_end: '2026-11-14', total: 249.9 };
    assert.deepEqual(
      { ...addExpensesFromStatement(db, { statement: stmt, rows: [row] }), statement_id: 0 },
      { inserted: 1, skipped_duplicates: 0, statement_id: 0 },
    );
    const again = addExpensesFromStatement(db, { rows: [{ ...row, merchant: 'adobe', card_id: card.id }] });
    assert.equal(again.inserted, 0);
    assert.equal(again.skipped_duplicates, 1);
  });
});

test('aynı ekstrede birebir aynı iki harcama ikisi de kaydedilir; yeniden içe aktarımda çoğalmaz', () => {
  withDb((db) => {
    const card = createCard(db, { bank: 'enpara', nickname: 'E', last4: '4321' });
    const metro = { occurred_on: '2026-11-05', amount: 27, merchant: 'Metro', category: 'ulasim' as const, card_id: card.id };
    assert.equal(addExpensesFromStatement(db, { rows: [metro, metro] }).inserted, 2);
    assert.deepEqual(
      { ...addExpensesFromStatement(db, { rows: [metro, metro, metro] }), statement_id: 0 },
      { inserted: 1, skipped_duplicates: 2, statement_id: 0 },
    );
  });
});

test('aynı gün aynı tutarda iki elle giriş iki ayrı harcamadır', () => {
  withDb((db) => {
    addExpense(db, row);
    addExpense(db, row);
    assert.equal(expenseSummary(db, '2026-11').byCategory[0]?.count, 2);
  });
});

test('kart dönemi kesim gününden sonra başlar', () => {
  withDb((db) => {
    const card = createCard(db, { bank: 'enpara', nickname: 'Enpara', last4: '9876', statement_day: 15 });
    addExpense(db, { ...row, card_id: card.id, occurred_on: '2026-11-15', amount: 100 });
    addExpense(db, { ...row, card_id: card.id, occurred_on: '2026-11-16', amount: 40 });
    const p = currentPeriodSpend(db, card, new Date(2026, 10, 20));
    assert.deepEqual(p, { from: '2026-11-16', spent: 40 });
    assert.equal(currentPeriodSpend(db, card, new Date(2026, 10, 10)).from, '2026-10-16');
  });
});

test('kart son 4 hane dışında numara kabul etmez', () => {
  withDb((db) => {
    assert.throws(() => createCard(db, { bank: 'other', nickname: 'x', last4: '1234567812345678' }));
  });
});
