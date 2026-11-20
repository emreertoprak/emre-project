import Link from 'next/link';
import { db } from '@/lib/db';
import { listReports } from '@/lib/repo/reports';
import { REPORT_KINDS, type ReportKind } from '@/lib/constants';
import { Empty, KIND_LABEL, PageTitle } from '@/components/ui';

export default async function Raporlar({ searchParams }: { searchParams: Promise<{ tur?: string }> }) {
  const { tur } = await searchParams;
  const kind = REPORT_KINDS.find((k) => k === tur) as ReportKind | undefined;
  const reports = listReports(db(), { kind });
  return (
    <>
      <PageTitle>Raporlar</PageTitle>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/raporlar" className={!kind ? 'btn-primary' : 'btn'}>Tümü</Link>
        {REPORT_KINDS.map((k) => <Link key={k} href={`/raporlar?tur=${k}`} className={k === kind ? 'btn-primary' : 'btn'}>{KIND_LABEL[k]}</Link>)}
      </div>
      {reports.length === 0 ? (
        <Empty><code>performance-review</code> skill&apos;ini çalıştır</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {reports.map((r) => (
            <Link key={r.id} href={`/raporlar/${r.id}`} className="card flex items-baseline justify-between hover:bg-foreground/5">
              <span className="font-medium">{r.title}</span>
              <span className="text-xs text-muted">{KIND_LABEL[r.kind]} · {r.created_at.slice(0, 10)}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
