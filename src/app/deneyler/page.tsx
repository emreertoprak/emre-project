import Link from 'next/link';
import Markdown from 'react-markdown';
import { db } from '@/lib/db';
import { listChannels } from '@/lib/repo/channels';
import { experimentContents, listExperiments } from '@/lib/repo/experiments';
import { EXPERIMENT_STATUS_LABEL, Empty, PageTitle } from '@/components/ui';

export default function Deneyler() {
  const d = db();
  const channels = listChannels(d);
  const all = listExperiments(d);
  return (
    <>
      <PageTitle>Deneyler</PageTitle>
      {all.length === 0 ? (
        <Empty>Deney yok — agent&apos;ta <code>content-write</code> skill&apos;ini çalıştır</Empty>
      ) : (
        channels.map((ch) => {
          const exps = all.filter((e) => e.channel_id === ch.id);
          if (exps.length === 0) return null;
          return (
            <section key={ch.id} className="mb-8">
              <h2 className="mb-2 font-semibold">@{ch.handle}</h2>
              <div className="flex flex-col gap-3">
                {exps.map((e) => {
                  const cs = experimentContents(d, e.id);
                  return (
                    <div key={e.id} className="card">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="font-medium">{e.hypothesis}</div>
                        <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs">{EXPERIMENT_STATUS_LABEL[e.status]}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted">Değişken: {e.variable} · Başlangıç: {e.started_at.slice(0, 10)}{e.ended_at ? ` · Bitiş: ${e.ended_at.slice(0, 10)}` : ''}</div>
                      {cs.length > 0 && (
                        <ul className="mt-2 text-sm">
                          {cs.map((c) => <li key={c.id}><Link href={`/icerik/${c.id}`} className="link">{c.title}</Link> <span className="text-xs text-muted">({c.status})</span></li>)}
                        </ul>
                      )}
                      {e.verdict_md && <div className="md mt-3 border-t border-line pt-3"><Markdown>{e.verdict_md}</Markdown></div>}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </>
  );
}
