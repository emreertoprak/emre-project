import type { ReactNode } from 'react';

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-semibold">{children}</h1>
      {sub && <div className="mt-1 text-sm text-muted">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">{children}</p>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="label">{label}{children}</label>;
}

const VERDICT_STYLE: Record<string, [string, string]> = {
  winner: ['Kazanan', 'bg-green-500/15 text-green-600'],
  loser: ['Kaybeden', 'bg-red-500/15 text-red-600'],
  average: ['Ortalama', 'bg-foreground/10'],
  pending: ['Bekliyor', 'bg-amber-500/15 text-amber-600'],
};

export function VerdictBadge({ verdict }: { verdict: string }) {
  const [label, cls] = VERDICT_STYLE[verdict] ?? [verdict, 'bg-foreground/10'];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export const fmtTry = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);
export const fmtNum = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat('tr-TR').format(n);
export const fmtDate = (iso: string) => iso.slice(0, 16).replace('T', ' ');
export const currentMonth = () => new Date().toISOString().slice(0, 7);
export const today = () => new Date().toISOString().slice(0, 10);

export const PLATFORM_LABEL: Record<string, string> = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok' };
export const STATUS_LABEL: Record<string, string> = {
  idea: 'Fikir', draft: 'Taslak', approved: 'Onaylı', produced: 'Üretildi', published: 'Yayınlandı', measured: 'Ölçüldü',
};
export const CHANNEL_STATUS_LABEL: Record<string, string> = { active: 'Aktif', paused: 'Duraklatıldı', retired: 'Emekli' };
export const EXPERIMENT_STATUS_LABEL: Record<string, string> = {
  running: 'Sürüyor', won: 'Kazandı', lost: 'Kaybetti', inconclusive: 'Belirsiz',
};
export const KIND_LABEL: Record<string, string> = {
  weekly: 'Haftalık', postmortem: 'Postmortem', algorithm: 'Algoritma', finance: 'Finans',
};
export const BANK_LABEL: Record<string, string> = { yapikredi: 'Yapı Kredi', enpara: 'Enpara', other: 'Diğer' };
