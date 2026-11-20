import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getChannel } from '@/lib/repo/channels';
import { getContent } from '@/lib/repo/contents';
import { getViralRef } from '@/lib/repo/viral';
import { getExperiment } from '@/lib/repo/experiments';
import { listCreatives } from '@/lib/repo/creatives';
import { contentMetricSeries } from '@/lib/repo/metrics';
import { channelSummary } from '@/lib/performance';
import { ActionForm } from '@/components/ActionForm';
import { Sparkline } from '@/components/Sparkline';
import { CreativePreview } from '@/components/CreativePreview';
import {
  addManualMetricAction, approveContentAction, markProducedAction, publishContentAction, updateContentAction,
} from '@/app/actions';
import { Empty, Field, PageTitle, STATUS_LABEL, VerdictBadge, fmtDate, fmtNum, today } from '@/components/ui';

export default async function IcerikDetay({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const d = db();
  const c = Number.isInteger(id) ? getContent(d, id) : null;
  if (!c) notFound();

  const channel = getChannel(d, c.channel_id);
  const ref = c.viral_ref_id ? getViralRef(d, c.viral_ref_id) : null;
  const parent = c.parent_content_id ? getContent(d, c.parent_content_id) : null;
  const exp = c.experiment_id ? getExperiment(d, c.experiment_id) : null;
  const creatives = listCreatives(d, { content_id: id });
  const series = contentMetricSeries(d, id);
  const verdict = channelSummary(d, c.channel_id, 3650).contents.find((x) => x.id === id)?.verdict;
  const published = c.status === 'published' || c.status === 'measured';

  return (
    <>
      <PageTitle sub={<>@{channel?.handle} · {c.format} · <span className="font-medium">{STATUS_LABEL[c.status]}</span>{verdict && published && <> · <VerdictBadge verdict={verdict} /></>}</>}>
        {c.title}
      </PageTitle>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {(c.status === 'draft' || c.status === 'idea') && (
          <ActionForm action={approveContentAction} label="Onayla" primary className="flex"><input type="hidden" name="id" value={id} /></ActionForm>
        )}
        {c.status === 'approved' && (
          <ActionForm action={markProducedAction} label="Üretildi" className="flex"><input type="hidden" name="id" value={id} /></ActionForm>
        )}
      </div>

      {(c.status === 'approved' || c.status === 'produced') && (
        <ActionForm action={publishContentAction} label="Yayınlandı" className="card mb-6 grid gap-3 md:grid-cols-3">
          <input type="hidden" name="id" value={id} />
          <Field label="Yayın URL'si"><input name="published_url" type="url" required className="input" /></Field>
          <Field label="Yayın tarihi"><input name="published_at" type="date" required defaultValue={today()} className="input" /></Field>
        </ActionForm>
      )}
      {published && c.published_url && (
        <p className="mb-4 text-sm">Yayın: <a href={c.published_url} target="_blank" rel="noreferrer" className="link">{c.published_url}</a> ({c.published_at}){c.platform_post_id ? '' : ' · platform id yok'}</p>
      )}

      <div className="mb-6 flex flex-wrap gap-4 text-sm">
        {ref && <span>Referans: {ref.url ? <a href={ref.url} target="_blank" rel="noreferrer" className="link">{ref.title || ref.url}</a> : (ref.title || `#${ref.id}`)}</span>}
        {parent && <span>Üst içerik: <Link href={`/icerik/${parent.id}`} className="link">{parent.title}</Link></span>}
        {exp && <span>Deney: {exp.hypothesis} <span className="text-muted">({exp.variable})</span></span>}
      </div>

      <ActionForm action={updateContentAction} label="Kaydet" primary className="card mb-8 flex flex-col gap-3">
        <input type="hidden" name="id" value={id} />
        <Field label="Başlık"><input name="title" defaultValue={c.title} required className="input" /></Field>
        <Field label="Hook"><textarea name="hook" defaultValue={c.hook} rows={2} className="input" /></Field>
        <Field label="Senaryo (markdown)"><textarea name="script_md" defaultValue={c.script_md} rows={14} className="input font-mono" /></Field>
        <Field label="Caption"><textarea name="caption" defaultValue={c.caption} rows={3} className="input" /></Field>
        <Field label="Hashtag'ler (virgülle)"><input name="hashtags" defaultValue={c.hashtags.join(', ')} className="input" /></Field>
      </ActionForm>

      <h2 className="mb-2 font-semibold">Creative&apos;ler</h2>
      {creatives.length === 0 ? (
        <div className="mb-8"><Empty>Creative yok — onaylı içerik için agent&apos;ta <code>creative-produce</code> skill&apos;ini çalıştır</Empty></div>
      ) : (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {creatives.map((cr) => <CreativePreview key={cr.id} creative={cr} />)}
        </div>
      )}

      <h2 className="mb-2 font-semibold">Metrikler</h2>
      {series.length === 0 ? (
        <div className="mb-4"><Empty>Metrik yok — yayınladıktan sonra <code>pnpm sync</code> çalıştır veya aşağıdan elle ekle</Empty></div>
      ) : (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-3 text-xs text-muted">İzlenme <Sparkline values={series.map((s) => s.views)} /></div>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full">
              <thead><tr className="border-b border-line">
                {['Zaman', 'Kaynak', 'İzlenme', 'Beğeni', 'Yorum', 'Paylaşım', 'İzlenme %'].map((h) => <th key={h} className="th">{h}</th>)}
              </tr></thead>
              <tbody>
                {series.map((s) => (
                  <tr key={`${s.captured_at}-${s.source}`} className="border-b border-line last:border-0">
                    <td className="td">{fmtDate(s.captured_at)}</td><td className="td">{s.source}</td>
                    <td className="td">{fmtNum(s.views)}</td><td className="td">{fmtNum(s.likes)}</td>
                    <td className="td">{fmtNum(s.comments)}</td><td className="td">{fmtNum(s.shares)}</td>
                    <td className="td">{s.avg_view_pct === null ? '—' : s.avg_view_pct.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ActionForm action={addManualMetricAction} label="Elle metrik ekle" className="card grid gap-3 md:grid-cols-5">
        <input type="hidden" name="content_id" value={id} />
        <Field label="İzlenme"><input name="views" type="number" min={0} required className="input" /></Field>
        <Field label="Beğeni"><input name="likes" type="number" min={0} required className="input" /></Field>
        <Field label="Yorum"><input name="comments" type="number" min={0} required className="input" /></Field>
        <Field label="Paylaşım (ops.)"><input name="shares" type="number" min={0} className="input" /></Field>
        <Field label="Kaydetme (ops.)"><input name="saves" type="number" min={0} className="input" /></Field>
      </ActionForm>
    </>
  );
}
