import Link from 'next/link';
import { db } from '@/lib/db';
import { listChannels } from '@/lib/repo/channels';
import { listNiches } from '@/lib/repo/niches';
import { listContents } from '@/lib/repo/contents';
import { expenseSummary } from '@/lib/repo/finance';
import { listReports } from '@/lib/repo/reports';
import { channelSummary } from '@/lib/performance';
import { Empty, PageTitle, PLATFORM_LABEL, currentMonth, fmtNum, fmtTry } from '@/components/ui';

export default function Home() {
  const d = db();
  const channels = listChannels(d);
  const niches = new Map(listNiches(d).map((n) => [n.key, n.label]));
  const drafts = listContents(d, { status: 'draft' }).length;
  const spend = expenseSummary(d, currentMonth()).total;
  const report = listReports(d, { limit: 1 })[0];

  return (
    <>
      <PageTitle>Genel Bakış</PageTitle>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Link href="/icerik" className="card hover:bg-foreground/5">
          <div className="text-xs text-muted">Onay bekleyen taslak</div>
          <div className="text-2xl font-semibold">{drafts}</div>
        </Link>
        <Link href="/giderler" className="card hover:bg-foreground/5">
          <div className="text-xs text-muted">Bu ay gider</div>
          <div className="text-2xl font-semibold">{fmtTry(spend)}</div>
        </Link>
        <div className="card">
          <div className="text-xs text-muted">Son rapor</div>
          {report ? (
            <Link href={`/raporlar/${report.id}`} className="link">{report.title}</Link>
          ) : (
            <span className="text-sm text-muted">Rapor yok</span>
          )}
        </div>
      </div>

      {channels.length === 0 ? (
        <Empty>Kanal yok — <Link href="/kanallar" className="link">Kanallar</Link> sayfasından ekle veya agent&apos;ta <code>brand-onboarding</code> skill&apos;ini çalıştır</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {channels.map((ch) => {
            const week = channelSummary(d, ch.id, 7);
            const month = channelSummary(d, ch.id, 30);
            const winners = month.contents.filter((c) => c.verdict === 'winner').length;
            const losers = month.contents.filter((c) => c.verdict === 'loser').length;
            const delta = week.followersDelta;
            return (
              <div key={ch.id} className="card">
                <div className="flex items-baseline justify-between">
                  <div className="font-semibold">@{ch.handle}</div>
                  <div className="text-xs text-muted">{PLATFORM_LABEL[ch.platform]}</div>
                </div>
                <div className="text-xs text-muted">{niches.get(ch.niche_key) ?? ch.niche_key}</div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold">{fmtNum(week.followersNow)}</span>
                  <span className="text-xs text-muted">takipçi</span>
                  {delta !== null && (
                    <span className={`text-xs ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {delta >= 0 ? '+' : ''}{fmtNum(delta)} / 7g
                    </span>
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div><dt className="text-muted">Baseline</dt><dd>{month.baseline === null ? '—' : fmtNum(Math.round(month.baseline))}</dd></div>
                  <div><dt className="text-muted">Kazanan (30g)</dt><dd className="text-green-600">{winners}</dd></div>
                  <div><dt className="text-muted">Kaybeden (30g)</dt><dd className="text-red-600">{losers}</dd></div>
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
