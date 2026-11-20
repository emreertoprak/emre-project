import { db } from '@/lib/db';
import { getContent } from '@/lib/repo/contents';
import { listCreatives } from '@/lib/repo/creatives';
import { CreativePreview } from '@/components/CreativePreview';
import { Empty, PageTitle } from '@/components/ui';

export default function Creative() {
  const d = db();
  const all = listCreatives(d);
  return (
    <>
      <PageTitle>Creative</PageTitle>
      {all.length === 0 ? (
        <Empty>Creative yok — onaylı içerik için agent&apos;ta <code>creative-produce</code> skill&apos;ini çalıştır</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {all.map((cr) => <CreativePreview key={cr.id} creative={cr} title={getContent(d, cr.content_id)?.title} />)}
        </div>
      )}
    </>
  );
}
