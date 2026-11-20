import Link from 'next/link';
import { notFound } from 'next/navigation';
import Markdown from 'react-markdown';
import { db } from '@/lib/db';
import { getReport } from '@/lib/repo/reports';
import { KIND_LABEL, PageTitle } from '@/components/ui';

export default async function Rapor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  const r = Number.isInteger(n) ? getReport(db(), n) : null;
  if (!r) notFound();
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/raporlar" className="link">← Raporlar</Link></p>
      <PageTitle sub={`${KIND_LABEL[r.kind]} · ${r.created_at.slice(0, 10)}${r.period_start ? ` · ${r.period_start} – ${r.period_end ?? ''}` : ''}`}>{r.title}</PageTitle>
      <div className="md max-w-3xl"><Markdown>{r.body_md}</Markdown></div>
    </>
  );
}
