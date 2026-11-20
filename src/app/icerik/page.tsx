import Link from 'next/link';
import { db } from '@/lib/db';
import { listChannels } from '@/lib/repo/channels';
import { listContents } from '@/lib/repo/contents';
import { CONTENT_STATUSES } from '@/lib/constants';
import { Empty, PageTitle, STATUS_LABEL } from '@/components/ui';

export default async function Icerik({ searchParams }: { searchParams: Promise<{ kanal?: string }> }) {
  const { kanal } = await searchParams;
  const d = db();
  const channels = listChannels(d);
  const byId = new Map(channels.map((c) => [c.id, c]));
  const channelId = Number(kanal) || undefined;
  const contents = listContents(d, { channel_id: channelId });

  return (
    <>
      <PageTitle>İçerik</PageTitle>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/icerik" className={!channelId ? 'btn-primary' : 'btn'}>Tümü</Link>
        {channels.map((c) => (
          <Link key={c.id} href={`/icerik?kanal=${c.id}`} className={c.id === channelId ? 'btn-primary' : 'btn'}>@{c.handle}</Link>
        ))}
      </div>
      {contents.length === 0 ? (
        <Empty>Taslak yok — agent&apos;ta <code>content-write</code> veya <code>viral-adapt</code> skill&apos;ini çalıştır</Empty>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3 2xl:grid-cols-6">
          {CONTENT_STATUSES.map((s) => {
            const col = contents.filter((c) => c.status === s);
            return (
              <div key={s} className="flex flex-col gap-2">
                <div className="text-xs font-medium text-muted">{STATUS_LABEL[s]} ({col.length})</div>
                {col.map((c) => (
                  <Link key={c.id} href={`/icerik/${c.id}`} className="card hover:bg-foreground/5">
                    <div className="font-medium">{c.title}</div>
                    <div className="mt-1 text-xs text-muted">{c.format} · @{byId.get(c.channel_id)?.handle ?? '?'}</div>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
