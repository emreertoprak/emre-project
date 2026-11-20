'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  cardCreate, channelMetricManual, channelUpsert, contentPatch, contentPublish, expenseRow,
  metricsRecord, nicheUpsert, viralRefAdd,
} from '@/lib/schemas';
import { CHANNEL_STATUSES } from '@/lib/constants';
import { upsertNiche } from '@/lib/repo/niches';
import { getChannel, recordChannelMetric, updateChannel, upsertChannel } from '@/lib/repo/channels';
import { addViralRef, addViralRefFromItem, platformFromUrl } from '@/lib/repo/viral';
import { getContent, publishContent, updateContent, youtubeIdFromUrl } from '@/lib/repo/contents';
import { recordContentMetric } from '@/lib/repo/metrics';
import { addExpense, createCard } from '@/lib/repo/finance';
import { fetchVideoMeta } from '@/lib/sync/ytdlp';

type State = { ok: boolean; message: string } | null;

const ok = (message: string): State => ({ ok: true, message });

function errorMessage(e: unknown): string {
  if (e instanceof z.ZodError) {
    return e.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
  }
  return e instanceof Error ? e.message : 'Bilinmeyen hata';
}

async function guard(fn: () => State | Promise<State>): Promise<State> {
  try {
    return await fn();
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
}

/** FormData yardımcıları: boş alan → undefined; sayılar number'a çevrilir. */
function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
}

function num(fd: FormData, key: string): number | undefined {
  const s = str(fd, key);
  if (s === undefined) return undefined;
  const n = Number(s.replace(',', '.'));
  if (Number.isNaN(n)) throw new Error(`${key}: sayı olmalı`);
  return n;
}

function list(fd: FormData, key: string): string[] {
  return (str(fd, key) ?? '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
}

function requireId(fd: FormData, key: string): number {
  const n = num(fd, key);
  if (!n) throw new Error(`${key} eksik`);
  return n;
}

// ── Kanallar ─────────────────────────────────────────────────────────────

export async function saveNicheAction(_p: State, fd: FormData): Promise<State> {
  return guard(() => {
    const input = nicheUpsert.parse({
      key: str(fd, 'key'),
      label: str(fd, 'label'),
      region_code: str(fd, 'region_code')?.toUpperCase(),
      queries: list(fd, 'queries'),
      subreddits: list(fd, 'subreddits'),
      hashtags: list(fd, 'hashtags'),
    });
    upsertNiche(db(), input);
    revalidatePath('/kanallar');
    revalidatePath('/trendler');
    return ok('Niş kaydedildi');
  });
}

export async function addChannelAction(_p: State, fd: FormData): Promise<State> {
  return guard(() => {
    const input = channelUpsert.parse({
      platform: str(fd, 'platform'),
      handle: str(fd, 'handle'),
      url: str(fd, 'url') ?? '',
      niche_key: str(fd, 'niche_key'),
    });
    upsertChannel(db(), input);
    revalidatePath('/kanallar');
    revalidatePath('/');
    return ok('Kanal kaydedildi');
  });
}

export async function updateChannelAction(_p: State, fd: FormData): Promise<State> {
  return guard(() => {
    const id = requireId(fd, 'id');
    const patch = z.object({
      url: z.string().default(''),
      status: z.enum(CHANNEL_STATUSES),
    }).parse({ url: str(fd, 'url') ?? '', status: str(fd, 'status') });
    updateChannel(db(), id, patch);
    revalidatePath('/kanallar');
    revalidatePath('/');
    return ok('Kanal güncellendi');
  });
}

export async function recordFollowersAction(_p: State, fd: FormData): Promise<State> {
  return guard(() => {
    const input = channelMetricManual.parse({
      channel_id: num(fd, 'channel_id'),
      followers: num(fd, 'followers'),
      total_views: num(fd, 'total_views'),
    });
    if (!getChannel(db(), input.channel_id)) throw new Error('Kanal yok');
    recordChannelMetric(db(), { ...input, source: 'manual' });
    revalidatePath('/kanallar');
    revalidatePath('/');
    return ok('Ölçüm kaydedildi');
  });
}

// ── Trendler / viral referanslar ─────────────────────────────────────────

export async function addViralRefFromItemAction(_p: State, fd: FormData): Promise<State> {
  return guard(() => {
    const itemId = str(fd, 'item_id');
    if (!itemId) throw new Error('item_id eksik');
    addViralRefFromItem(db(), itemId);
    revalidatePath('/trendler');
    return ok('Referansa alındı');
  });
}

export async function addViralRefAction(_p: State, fd: FormData): Promise<State> {
  return guard(async () => {
    const input = viralRefAdd.parse({
      url: str(fd, 'url'),
      niche_key: str(fd, 'niche_key'),
      transcript: str(fd, 'transcript'),
      notes: str(fd, 'notes'),
    });
    if (!input.url && !input.transcript && !input.notes) throw new Error('Link, transkript veya not girin');
    let title = input.title;
    let platform = input.url ? platformFromUrl(input.url) : undefined;
    if (input.url) {
      try {
        const meta = await fetchVideoMeta(input.url);
        title = meta.title || title;
        platform = meta.platform || platform;
      } catch {
        /* meta çekilemedi: verilen alanlarla kaydet */
      }
    }
    addViralRef(db(), { ...input, title, platform });
    revalidatePath('/trendler');
    return ok('Referans kaydedildi');
  });
}

// ── İçerik ───────────────────────────────────────────────────────────────

function revalidateContent(id: number) {
  revalidatePath(`/icerik/${id}`);
  revalidatePath('/icerik');
  revalidatePath('/');
}

export async function updateContentAction(_p: State, fd: FormData): Promise<State> {
  return guard(() => {
    const id = requireId(fd, 'id');
    const patch = contentPatch.parse({
      title: str(fd, 'title'),
      hook: str(fd, 'hook') ?? '',
      script_md: str(fd, 'script_md') ?? '',
      caption: str(fd, 'caption') ?? '',
      hashtags: list(fd, 'hashtags'),
    });
    updateContent(db(), id, patch, 'user');
    revalidateContent(id);
    return ok('Kaydedildi');
  });
}

function transition(id: number, from: readonly string[], to: 'approved' | 'produced'): State {
  const c = getContent(db(), id);
  if (!c) throw new Error('İçerik yok');
  if (!from.includes(c.status)) throw new Error(`"${c.status}" durumundan "${to}" durumuna geçilemez`);
  updateContent(db(), id, { status: to }, 'user');
  revalidateContent(id);
  return ok(to === 'approved' ? 'Onaylandı' : 'Üretildi olarak işaretlendi');
}

export async function approveContentAction(_p: State, fd: FormData): Promise<State> {
  return guard(() => transition(requireId(fd, 'id'), ['idea', 'draft'], 'approved'));
}

export async function markProducedAction(_p: State, fd: FormData): Promise<State> {
  return guard(() => transition(requireId(fd, 'id'), ['approved'], 'produced'));
}

export async function publishContentAction(_p: State, fd: FormData): Promise<State> {
  return guard(async () => {
    const input = contentPublish.parse({
      id: num(fd, 'id'),
      published_url: str(fd, 'published_url'),
      published_at: str(fd, 'published_at'),
    });
    const c = getContent(db(), input.id);
    if (!c) throw new Error('İçerik yok');
    if (c.status !== 'approved' && c.status !== 'produced') {
      throw new Error('Yalnızca onaylı veya üretilmiş içerik yayınlanabilir');
    }
    const ch = getChannel(db(), c.channel_id);
    if (!ch) throw new Error('Kanal yok');
    const postId = ch.platform === 'youtube'
      ? youtubeIdFromUrl(input.published_url)
      : ((await fetchVideoMeta(input.published_url).catch(() => null))?.id ?? null);
    publishContent(db(), { ...input, platform_post_id: postId });
    revalidateContent(input.id);
    return ok(postId ? 'Yayınlandı' : 'Yayınlandı (platform id bulunamadı; metrik elle girilebilir)');
  });
}

export async function addManualMetricAction(_p: State, fd: FormData): Promise<State> {
  return guard(() => {
    const input = metricsRecord.parse({
      content_id: num(fd, 'content_id'),
      views: num(fd, 'views'),
      likes: num(fd, 'likes'),
      comments: num(fd, 'comments'),
      shares: num(fd, 'shares'),
      saves: num(fd, 'saves'),
    });
    if (!getContent(db(), input.content_id)) throw new Error('İçerik yok');
    recordContentMetric(db(), { ...input, source: 'manual' }, 0);
    revalidateContent(input.content_id);
    return ok('Metrik eklendi');
  });
}

// ── Giderler ─────────────────────────────────────────────────────────────

export async function addExpenseAction(_p: State, fd: FormData): Promise<State> {
  return guard(() => {
    const input = expenseRow.parse({
      occurred_on: str(fd, 'occurred_on'),
      amount: num(fd, 'amount'),
      merchant: str(fd, 'merchant'),
      category: str(fd, 'category'),
      card_id: num(fd, 'card_id'),
      channel_id: num(fd, 'channel_id'),
      note: str(fd, 'note'),
    });
    addExpense(db(), input);
    revalidatePath('/giderler');
    revalidatePath('/');
    return ok('Gider eklendi');
  });
}

export async function addCardAction(_p: State, fd: FormData): Promise<State> {
  return guard(() => {
    const input = cardCreate.parse({
      bank: str(fd, 'bank'),
      nickname: str(fd, 'nickname'),
      last4: str(fd, 'last4'),
      limit_try: num(fd, 'limit_try'),
      statement_day: num(fd, 'statement_day'),
      due_day: num(fd, 'due_day'),
    });
    createCard(db(), input);
    revalidatePath('/giderler');
    return ok('Kart eklendi');
  });
}
