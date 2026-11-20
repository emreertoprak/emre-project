import { createHash, randomUUID } from 'node:crypto';
import { nowIso, type DB } from '../db';
import type { Bank, ExpenseCategory, ExpenseSource } from '../constants';
import type { CardCreate, ExpenseRow, StatementInput } from '../schemas';

export type Card = {
  id: number; bank: Bank; nickname: string; last4: string;
  limit_try: number | null; statement_day: number | null; due_day: number | null;
};

export type Expense = {
  id: number; occurred_on: string; amount: number; currency: string; merchant: string;
  category: ExpenseCategory; card_id: number | null; channel_id: number | null; note: string;
  source: ExpenseSource; statement_id: number | null; dedupe_key: string;
};

export function listCards(db: DB): Card[] {
  return db.prepare('SELECT * FROM cards ORDER BY bank, nickname').all() as Card[];
}

export function createCard(db: DB, c: CardCreate): Card {
  const r = db.prepare(`
    INSERT INTO cards (bank, nickname, last4, limit_try, statement_day, due_day) VALUES (?, ?, ?, ?, ?, ?)
  `).run(c.bank, c.nickname, c.last4, c.limit_try ?? null, c.statement_day ?? null, c.due_day ?? null);
  return db.prepare('SELECT * FROM cards WHERE id = ?').get(r.lastInsertRowid) as Card;
}

/**
 * Ekstre satırı: aynı ekstrede birebir aynı iki harcama (ör. iki metro geçişi) `occurrence` ile ayrılır;
 * aynı ekstre tekrar içe aktarılınca aynı anahtarlar üretilir ve satırlar çoğalmaz.
 * Elle giriş: her giriş ayrı harcamadır.
 */
export function dedupeKey(row: ExpenseRow, source: ExpenseSource, occurrence = 0): string {
  const base = `${row.occurred_on}|${row.amount}|${row.merchant.toLowerCase().trim()}|${row.card_id ?? ''}`;
  const key = source === 'manual' ? `${base}|manual|${randomUUID()}` : `${base}|${occurrence}`;
  return createHash('sha1').update(key).digest('hex');
}

export function addExpense(db: DB, row: ExpenseRow): Expense {
  const id = insertExpense(db, row, 'manual', null, 0);
  return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Expense;
}

function insertExpense(db: DB, row: ExpenseRow, source: ExpenseSource, statementId: number | null, occurrence: number): number | null {
  const r = db.prepare(`
    INSERT OR IGNORE INTO expenses (occurred_on, amount, merchant, category, card_id, channel_id, note, source, statement_id, dedupe_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.occurred_on, row.amount, row.merchant.trim(), row.category, row.card_id ?? null, row.channel_id ?? null,
    row.note ?? '', source, statementId, dedupeKey(row, source, occurrence),
  );
  return r.changes === 1 ? Number(r.lastInsertRowid) : null;
}

/** Ekstre içe aktarma: tek transaction; tekrar eden satırlar sessizce atlanır ve sayılır. */
export function addExpensesFromStatement(
  db: DB,
  input: { statement?: StatementInput; rows: ExpenseRow[] },
): { inserted: number; skipped_duplicates: number; statement_id: number | null } {
  return db.transaction(() => {
    let statementId: number | null = null;
    if (input.statement) {
      const s = input.statement;
      statementId = Number(db.prepare(`
        INSERT INTO statements (card_id, file_path, period_start, period_end, total, imported_at) VALUES (?, ?, ?, ?, ?, ?)
      `).run(s.card_id, s.file_path, s.period_start, s.period_end, s.total, nowIso()).lastInsertRowid);
    }
    let inserted = 0;
    const seen = new Map<string, number>();
    for (const row of input.rows) {
      const withCard = { ...row, card_id: row.card_id ?? input.statement?.card_id };
      const base = `${withCard.occurred_on}|${withCard.amount}|${withCard.merchant.toLowerCase().trim()}|${withCard.card_id ?? ''}`;
      const occurrence = seen.get(base) ?? 0;
      seen.set(base, occurrence + 1);
      if (insertExpense(db, withCard, 'statement', statementId, occurrence) !== null) inserted++;
    }
    return { inserted, skipped_duplicates: input.rows.length - inserted, statement_id: statementId };
  })();
}

export function listExpenses(db: DB, month: string): Expense[] {
  return db.prepare("SELECT * FROM expenses WHERE substr(occurred_on, 1, 7) = ? ORDER BY occurred_on DESC, id DESC")
    .all(month) as Expense[];
}

export type ExpenseSummary = {
  month: string;
  total: number;
  byCategory: { category: string; total: number; count: number }[];
  byCard: { card_id: number | null; nickname: string | null; total: number; count: number }[];
};

export function expenseSummary(db: DB, month: string): ExpenseSummary {
  const byCategory = db.prepare(`
    SELECT category, SUM(amount) AS total, COUNT(*) AS count FROM expenses
    WHERE substr(occurred_on, 1, 7) = ? GROUP BY category ORDER BY total DESC
  `).all(month) as ExpenseSummary['byCategory'];
  const byCard = db.prepare(`
    SELECT e.card_id, c.nickname, SUM(e.amount) AS total, COUNT(*) AS count
    FROM expenses e LEFT JOIN cards c ON c.id = e.card_id
    WHERE substr(e.occurred_on, 1, 7) = ? GROUP BY e.card_id ORDER BY total DESC
  `).all(month) as ExpenseSummary['byCard'];
  const total = byCategory.reduce((s, r) => s + r.total, 0);
  return { month, total, byCategory, byCard };
}

/**
 * Kartın içinde bulunulan hesap dönemindeki harcaması: son kesim gününden (dahil değil) bugüne.
 * Kesim günü tanımsızsa takvim ayı.
 */
export function currentPeriodSpend(db: DB, card: Card, today = new Date()): { from: string; spent: number } {
  const y = today.getFullYear();
  const m = today.getMonth();
  let from: Date;
  if (card.statement_day) {
    const cut = new Date(y, m, card.statement_day);
    from = today.getDate() > card.statement_day ? cut : new Date(y, m - 1, card.statement_day);
    from.setDate(from.getDate() + 1);
  } else {
    from = new Date(y, m, 1);
  }
  const fromIso = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
  const r = db.prepare('SELECT COALESCE(SUM(amount), 0) AS spent FROM expenses WHERE card_id = ? AND occurred_on >= ?')
    .get(card.id, fromIso) as { spent: number };
  return { from: fromIso, spent: r.spent };
}
