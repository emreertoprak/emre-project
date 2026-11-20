import Link from 'next/link';
import Markdown from 'react-markdown';
import { db } from '@/lib/db';
import { listNiches } from '@/lib/repo/niches';
import { listViralRefs } from '@/lib/repo/viral';
import { scoreAll } from '@/lib/trend/pipeline';
import { ActionForm } from '@/components/ActionForm';
import { addViralRefAction, addViralRefFromItemAction } from '@/app/actions';
import { Empty, Field, PageTitle, fmtNum } from '@/components/ui';

export default async function Trendler({ searchParams }: { searchParams: Promise<{ nis?: string }> }) {
  const { nis } = await searchParams;
  const d = db();
  const niches = listNiches(d);
  if (niches.length === 0) {
    return (<><PageTitle>Trendler</PageTitle><Empty>Niş yok — <Link href="/kanallar" className="link">Kanallar</Link> sayfasından niş ekle, sonra <code>pnpm collect</code> çalıştır</Empty></>);
  }
  const key = niches.some((n) => n.key === nis) ? nis! : niches[0]!.key;
  const rows = scoreAll(d, Number(process.env.LOOKBACK_HOURS ?? 168)).get(key) ?? [];
  const refs = listViralRefs(d, { niche_key: key });

  return (
    <>
      <PageTitle>Trendler</PageTitle>
      <div className="mb-4 flex flex-wrap gap-2">
        {niches.map((n) => (
          <Link key={n.key} href={`/trendler?nis=${n.key}`}
            className={n.key === key ? 'btn-primary' : 'btn'}>{n.label}</Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <Empty>Henüz veri yok — <code>pnpm collect</code> çalıştır</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full">
            <thead><tr className="border-b border-line">
              {['Başlık', 'Kanal', 'İzlenme', 'Outlier', 'Hız', 'İvme', 'Skor', ''].map((h) => <th key={h} className="th">{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="td max-w-md"><a href={r.url} target="_blank" rel="noreferrer" className="link">{r.title}</a></td>
                  <td className="td">{r.authorName}</td>
                  <td className="td">{fmtNum(r.views)}</td>
                  <td className="td">{r.outlierScore.toFixed(1)}×</td>
                  <td className="td">{r.velocityPerHour === null ? '—' : `${fmtNum(Math.round(r.velocityPerHour))}/saat`}</td>
                  <td className="td">{r.accelerating === null ? '–' : r.accelerating ? '↑' : '↓'}</td>
                  <td className="td">{r.score.toFixed(2)}</td>
                  <td className="td">
                    <ActionForm action={addViralRefFromItemAction} label="Referansa al" className="flex">
                      <input type="hidden" name="item_id" value={r.id} />
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mb-2 mt-8 font-semibold">Link / transkript ekle</h2>
      <ActionForm action={addViralRefAction} label="Referans ekle" primary className="card flex flex-col gap-3">
        <input type="hidden" name="niche_key" value={key} />
        <Field label="Link (ops.)"><input name="url" type="url" className="input" /></Field>
        <Field label="Transkript"><textarea name="transcript" rows={4} className="input" /></Field>
        <Field label="Notlar"><textarea name="notes" rows={2} className="input" /></Field>
      </ActionForm>

      <h2 className="mb-2 mt-8 font-semibold">Viral referanslar</h2>
      {refs.length === 0 ? (
        <Empty>Referans yok — yukarıdan &ldquo;Referansa al&rdquo; ile ekle, ardından agent&apos;ta <code>viral-adapt</code> skill&apos;ini çalıştır</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {refs.map((v) => (
            <div key={v.id} className="card">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  {v.url ? <a href={v.url} target="_blank" rel="noreferrer" className="link">{v.title || v.url}</a> : (v.title || `Referans #${v.id}`)}
                  <span className="ml-2 text-xs text-muted">{v.platform}</span>
                </div>
                <span className="text-xs text-muted">{v.analysis_md ? 'Analiz var' : 'Analiz yok'}</span>
              </div>
              {v.analysis_md && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted">Analizi göster</summary>
                  <div className="md mt-2"><Markdown>{v.analysis_md}</Markdown></div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
