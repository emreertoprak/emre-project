import { readFile, realpath } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
};

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (path.some((s) => s === '..' || s === '.' || s.includes('\0') || s.includes('/') || s.includes('\\'))) {
    return new Response('Geçersiz yol', { status: 400 });
  }
  const root = resolve(process.cwd(), 'creatives');
  const target = resolve(root, ...path);
  if (target !== root && !target.startsWith(root + sep)) return new Response('Geçersiz yol', { status: 400 });

  const type = TYPES[extname(target).toLowerCase()];
  if (!type) return new Response('Desteklenmeyen dosya türü', { status: 404 });
  try {
    const real = await realpath(target);
    const realRoot = await realpath(root);
    if (!real.startsWith(realRoot + sep)) return new Response('Geçersiz yol', { status: 400 });
    const buf = await readFile(real);
    return new Response(new Uint8Array(buf), { headers: { 'content-type': type, 'cache-control': 'no-store' } });
  } catch {
    return new Response('Bulunamadı', { status: 404 });
  }
}
