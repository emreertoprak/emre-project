import { db } from '@/lib/db';
import { listChannels } from '@/lib/repo/channels';
import { listNiches } from '@/lib/repo/niches';
import { CHANNEL_STATUSES, PLATFORMS } from '@/lib/constants';
import { ActionForm } from '@/components/ActionForm';
import {
  addChannelAction, recordFollowersAction, saveNicheAction, updateChannelAction,
} from '@/app/actions';
import { CHANNEL_STATUS_LABEL, Empty, Field, PageTitle, PLATFORM_LABEL } from '@/components/ui';

export default function Kanallar() {
  const d = db();
  const niches = listNiches(d);
  const channels = listChannels(d);

  return (
    <>
      <PageTitle sub="Her niş ayrı kanaldır; kanalın nişi oluşturulduktan sonra değiştirilemez.">Kanallar</PageTitle>

      <h2 className="mb-2 font-semibold">Nişler</h2>
      {niches.length === 0 ? (
        <Empty>Niş yok — aşağıdan ekle veya agent&apos;ta <code>brand-onboarding</code> skill&apos;ini çalıştır</Empty>
      ) : (
        <div className="mb-4 grid gap-2 md:grid-cols-2">
          {niches.map((n) => (
            <div key={n.key} className="card text-xs">
              <div className="text-sm font-semibold">{n.label} <span className="font-normal text-muted">({n.key}{n.regionCode ? `, ${n.regionCode}` : ''})</span></div>
              <div className="mt-1"><span className="text-muted">Sorgular:</span> {n.queries.join(', ') || '—'}</div>
              <div><span className="text-muted">Subreddit:</span> {n.subreddits.join(', ') || '—'}</div>
              <div><span className="text-muted">Hashtag:</span> {n.hashtags.join(', ') || '—'}</div>
            </div>
          ))}
        </div>
      )}
      <details className="card mb-8">
        <summary className="cursor-pointer font-medium">Niş ekle / güncelle</summary>
        <ActionForm action={saveNicheAction} label="Kaydet" primary className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Anahtar (küçük harf, tire)"><input name="key" required pattern="[a-z0-9\-]+" className="input" /></Field>
          <Field label="Ad"><input name="label" required className="input" /></Field>
          <Field label="Bölge kodu (TR, US…)"><input name="region_code" maxLength={2} className="input" /></Field>
          <div />
          <Field label="YouTube sorguları (virgül veya satır ile)"><textarea name="queries" rows={3} className="input" /></Field>
          <Field label="Subreddit'ler"><textarea name="subreddits" rows={3} className="input" /></Field>
          <Field label="Hashtag'ler"><textarea name="hashtags" rows={3} className="input" /></Field>
        </ActionForm>
      </details>

      <h2 className="mb-2 font-semibold">Kanallar</h2>
      {channels.length === 0 ? (
        <Empty>Kanal yok — önce niş ekle, sonra aşağıdan kanal ekle</Empty>
      ) : (
        <div className="mb-4 grid gap-3 xl:grid-cols-2">
          {channels.map((ch) => (
            <div key={ch.id} className="card">
              <div className="flex items-baseline justify-between">
                <div className="font-semibold">@{ch.handle} <span className="text-xs font-normal text-muted">{PLATFORM_LABEL[ch.platform]}</span></div>
                <div className="font-mono text-xs text-muted">id: {ch.id}</div>
              </div>
              {ch.platform === 'youtube' && (
                <div className="mt-1 text-xs">
                  {ch.yt_refresh_token
                    ? <span className="text-green-600">Analytics bağlı</span>
                    : <span className="text-muted">Analytics bağlı değil — <code>pnpm yt-auth {ch.id}</code></span>}
                </div>
              )}
              <ActionForm action={updateChannelAction} label="Güncelle" className="mt-3 grid grid-cols-2 gap-2">
                <input type="hidden" name="id" value={ch.id} />
                <Field label="Niş (kilitli)"><input value={ch.niche_key} disabled readOnly className="input opacity-60" /></Field>
                <Field label="Durum">
                  <select name="status" defaultValue={ch.status} className="input">
                    {CHANNEL_STATUSES.map((s) => <option key={s} value={s}>{CHANNEL_STATUS_LABEL[s]}</option>)}
                  </select>
                </Field>
                <div className="col-span-2"><Field label="URL"><input name="url" defaultValue={ch.url} className="input" /></Field></div>
              </ActionForm>
              <ActionForm action={recordFollowersAction} label="Ölçüm ekle" className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
                <input type="hidden" name="channel_id" value={ch.id} />
                <Field label="Takipçi (elle)"><input name="followers" type="number" min={0} required className="input" /></Field>
                <Field label="Toplam izlenme (ops.)"><input name="total_views" type="number" min={0} className="input" /></Field>
              </ActionForm>
            </div>
          ))}
        </div>
      )}
      <details className="card">
        <summary className="cursor-pointer font-medium">Kanal ekle</summary>
        <ActionForm action={addChannelAction} label="Ekle" primary className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Platform">
            <select name="platform" className="input" required>
              {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
            </select>
          </Field>
          <Field label="Kullanıcı adı (handle)"><input name="handle" required className="input" /></Field>
          <Field label="URL"><input name="url" className="input" /></Field>
          <Field label="Niş">
            <select name="niche_key" className="input" required>
              {niches.map((n) => <option key={n.key} value={n.key}>{n.label}</option>)}
            </select>
          </Field>
        </ActionForm>
      </details>
    </>
  );
}
