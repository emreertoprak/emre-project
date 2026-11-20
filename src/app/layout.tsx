import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Creator OS' };

const NAV = [
  ['/', 'Genel Bakış'],
  ['/kanallar', 'Kanallar'],
  ['/trendler', 'Trendler'],
  ['/icerik', 'İçerik'],
  ['/deneyler', 'Deneyler'],
  ['/creative', 'Creative'],
  ['/giderler', 'Giderler'],
  ['/raporlar', 'Raporlar'],
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="flex min-h-screen">
        <aside className="sticky top-0 flex h-screen w-48 shrink-0 flex-col gap-1 border-r border-line p-4">
          <div className="mb-4 text-base font-semibold">Creator OS</div>
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-md px-2 py-1.5 hover:bg-foreground/5">
              {label}
            </Link>
          ))}
        </aside>
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </body>
    </html>
  );
}
