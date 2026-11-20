import { db } from '@/lib/db';
import { listChannels } from '@/lib/repo/channels';
import { currentPeriodSpend, expenseSummary, listCards, listExpenses } from '@/lib/repo/finance';
import { BANKS, EXPENSE_CATEGORIES } from '@/lib/constants';
import { ActionForm } from '@/components/ActionForm';
import { addCardAction, addExpenseAction } from '@/app/actions';
import { BANK_LABEL, Empty, Field, PageTitle, currentMonth, fmtTry, today } from '@/components/ui';

export default async function Giderler({ searchParams }: { searchParams: Promise<{ ay?: string }> }) {
  const { ay } = await searchParams;
  const month = ay && /^\d{4}-\d{2}$/.test(ay) ? ay : currentMonth();
  const d = db();
  const summary = expenseSummary(d, month);
  const expenses = listExpenses(d, month);
  const cards = listCards(d);
  const cardName = new Map(cards.map((c) => [c.id, `${c.nickname} ••${c.last4}`]));
  const channels = listChannels(d);

  return (
    <>
      <PageTitle>Giderler</PageTitle>
      <form className="mb-4 flex items-end gap-2">
        <Field label="Ay"><input type="month" name="ay" defaultValue={month} className="input" /></Field>
        <button className="btn" type="submit">Göster</button>
        <div className="ml-auto text-right"><div className="text-xs text-muted">Toplam</div><div className="text-xl font-semibold">{fmtTry(summary.total)}</div></div>
      </form>

      {expenses.length === 0 ? (
        <Empty>Kart ekle veya <code>inbox/statements/</code> klasörüne ekstre bırakıp <code>finance-import</code> skill&apos;ini çalıştır</Empty>
      ) : (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <SummaryTable title="Kategori" rows={summary.byCategory.map((r) => [r.category, r.count, r.total])} />
            <SummaryTable title="Kart" rows={summary.byCard.map((r) => [r.nickname ?? 'Kartsız', r.count, r.total])} />
          </div>
          <div className="mb-6 overflow-x-auto rounded-lg border border-line">
            <table className="w-full">
              <thead><tr className="border-b border-line">
                {['Tarih', 'İşyeri', 'Kategori', 'Kart', 'Tutar', 'Not'].map((h) => <th key={h} className="th">{h}</th>)}
              </tr></thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0">
                    <td className="td">{e.occurred_on}</td><td className="td">{e.merchant}</td><td className="td">{e.category}</td>
                    <td className="td">{e.card_id ? cardName.get(e.card_id) ?? '—' : '—'}</td>
                    <td className="td text-right">{fmtTry(e.amount)}</td><td className="td text-muted">{e.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="mb-2 font-semibold">Gider ekle</h2>
      <ActionForm action={addExpenseAction} label="Ekle" primary className="card mb-8 grid gap-3 md:grid-cols-3">
        <Field label="Tarih"><input name="occurred_on" type="date" required defaultValue={today()} className="input" /></Field>
        <Field label="Tutar (TRY)"><input name="amount" type="number" step="0.01" required className="input" /></Field>
        <Field label="İşyeri"><input name="merchant" required className="input" /></Field>
        <Field label="Kategori">
          <select name="category" required className="input">{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </Field>
        <Field label="Kart (ops.)">
          <select name="card_id" className="input"><option value="">—</option>{cards.map((c) => <option key={c.id} value={c.id}>{cardName.get(c.id)}</option>)}</select>
        </Field>
        <Field label="Kanal (ops.)">
          <select name="channel_id" className="input"><option value="">—</option>{channels.map((c) => <option key={c.id} value={c.id}>@{c.handle}</option>)}</select>
        </Field>
        <div className="md:col-span-3"><Field label="Not"><input name="note" className="input" /></Field></div>
      </ActionForm>

      <h2 className="mb-2 font-semibold">Kartlar</h2>
      {cards.length === 0 ? (
        <div className="mb-4"><Empty>Kart yok — aşağıdan ekle</Empty></div>
      ) : (
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => {
            const p = currentPeriodSpend(d, c);
            return (
              <div key={c.id} className="card">
                <div className="font-semibold">{c.nickname} <span className="font-normal text-muted">•••• {c.last4}</span></div>
                <div className="text-xs text-muted">{BANK_LABEL[c.bank]} · kesim: {c.statement_day ?? '—'} · son ödeme: {c.due_day ?? '—'}</div>
                <div className="mt-2 text-sm">{fmtTry(p.spent)} {c.limit_try ? <span className="text-muted">/ {fmtTry(c.limit_try)}</span> : null}</div>
                {c.limit_try ? (
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-foreground/10">
                    <div className="h-full bg-foreground" style={{ width: `${Math.min(100, (p.spent / c.limit_try) * 100)}%` }} />
                  </div>
                ) : null}
                <div className="mt-1 text-xs text-muted">{p.from} tarihinden beri</div>
              </div>
            );
          })}
        </div>
      )}
      <details className="card">
        <summary className="cursor-pointer font-medium">Kart ekle</summary>
        <ActionForm action={addCardAction} label="Kart ekle" primary className="mt-3 grid gap-3 md:grid-cols-3">
          <p className="text-xs text-muted md:col-span-3">Sadece son 4 hane. Tam kart numarası, CVV, son kullanma tarihi girilmez.</p>
          <Field label="Banka">
            <select name="bank" required className="input">{BANKS.map((b) => <option key={b} value={b}>{BANK_LABEL[b]}</option>)}</select>
          </Field>
          <Field label="Takma ad"><input name="nickname" required className="input" /></Field>
          <Field label="Son 4 hane"><input name="last4" required pattern="\d{4}" maxLength={4} inputMode="numeric" className="input" /></Field>
          <Field label="Limit (TRY)"><input name="limit_try" type="number" min={0} step="0.01" className="input" /></Field>
          <Field label="Kesim günü"><input name="statement_day" type="number" min={1} max={31} className="input" /></Field>
          <Field label="Son ödeme günü"><input name="due_day" type="number" min={1} max={31} className="input" /></Field>
        </ActionForm>
      </details>
    </>
  );
}

function SummaryTable({ title, rows }: { title: string; rows: [string, number, number][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full">
        <thead><tr className="border-b border-line"><th className="th">{title}</th><th className="th">Adet</th><th className="th text-right">Toplam</th></tr></thead>
        <tbody>
          {rows.map(([name, count, total]) => (
            <tr key={name} className="border-b border-line last:border-0">
              <td className="td">{name}</td><td className="td">{count}</td><td className="td text-right">{fmtTry(total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
