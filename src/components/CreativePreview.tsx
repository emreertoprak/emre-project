import type { Creative } from '@/lib/repo/creatives';

const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

export function creativeSrc(filePath: string): string {
  const rel = filePath.replace(/^\.?\/?creatives\//, '');
  return `/api/creative/${rel.split('/').map(encodeURIComponent).join('/')}`;
}

export function CreativePreview({ creative: cr, title }: { creative: Creative; title?: string }) {
  const isVideo = cr.file_path ? VIDEO_EXT.test(cr.file_path) : cr.kind === 'video';
  return (
    <div className="card flex flex-col gap-2">
      {cr.file_path ? (
        isVideo
          ? <video src={creativeSrc(cr.file_path)} controls className="max-h-80 w-full rounded-md bg-black/5 object-contain" />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={creativeSrc(cr.file_path)} alt={cr.prompt || cr.kind} className="max-h-80 w-full rounded-md bg-black/5 object-contain" />
      ) : cr.remote_url ? (
        <a href={cr.remote_url} target="_blank" rel="noreferrer" className="link break-all">{cr.remote_url}</a>
      ) : null}
      <div className="text-xs text-muted">
        {title && <div className="font-medium text-foreground">{title}</div>}
        {cr.purpose === 'ad' ? 'Reklam' : 'Organik'} · {cr.tool} · {cr.aspect_ratio} · {cr.kind}
      </div>
    </div>
  );
}
