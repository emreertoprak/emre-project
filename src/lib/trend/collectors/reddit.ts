import type { Collector, CollectorResult, NicheConfig, TrendItem } from '../types';

/**
 * Reddit burada *video metrik* kaynağı değil, **fikir/konu** kaynağıdır.
 * Şemayı ortak tutmak için `views` alanına upvote sayısı yazılır;
 * outlier paydası da subreddit abone sayısıdır. Digest bunu ayrı bölümde gösterir.
 *
 * Anonim `.json` erişimi Reddit tarafından kapatıldı (403) — OAuth zorunlu.
 * "script" tipi uygulama + client_credentials akışı yeterli (salt okunur).
 */

// HTTP header'ları ASCII olmak zorunda (ByteString) — burada Türkçe karakter kullanma.
const UA = 'content-research/0.1 (personal trend research tool)';
const OAUTH_BASE = 'https://oauth.reddit.com';
const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';

type ListingResponse = {
  data?: {
    children?: {
      data: {
        id: string; title: string; selftext?: string; permalink: string;
        author: string; created_utc: number; ups: number; num_comments: number;
        over_18: boolean; stickied: boolean;
      };
    }[];
  };
};

type AboutResponse = { data?: { subscribers?: number } };
type TokenResponse = { access_token?: string; expires_in?: number; error?: string };

export type RedditOptions = {
  clientId: string;
  clientSecret: string;
  timeframe: 'day' | 'week' | 'month';
  perSubreddit: number;
};

/** Token'ı süresi dolana kadar bellekte tutar; her istekte yeniden almaz. */
function createTokenProvider(clientId: string, clientSecret: string) {
  let token: string | null = null;
  let expiresAt = 0;

  return async function getToken(): Promise<string> {
    if (token && Date.now() < expiresAt) return token;

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': UA,
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      throw new Error(
        `Reddit token ${res.status} — REDDIT_CLIENT_ID/SECRET hatalı olabilir ` +
        `(reddit.com/prefs/apps > "script" tipi app)`,
      );
    }

    const data = (await res.json()) as TokenResponse;
    if (!data.access_token) throw new Error(`Reddit token alınamadı: ${data.error ?? 'bilinmeyen hata'}`);

    token = data.access_token;
    // 60 sn güvenlik payı bırak.
    expiresAt = Date.now() + Math.max((data.expires_in ?? 3600) - 60, 60) * 1000;
    return token;
  };
}

export function createRedditCollector(opts: RedditOptions): Collector {
  const getToken = createTokenProvider(opts.clientId, opts.clientSecret);

  async function getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${OAUTH_BASE}${path}`, {
      headers: { Authorization: `Bearer ${await getToken()}`, 'User-Agent': UA },
    });
    if (!res.ok) throw new Error(`Reddit ${res.status} @ ${path}`);
    return (await res.json()) as T;
  }

  return {
    name: 'reddit',
    isConfigured: () => opts.clientId.length > 0 && opts.clientSecret.length > 0,

    async collect(niche: NicheConfig): Promise<CollectorResult[]> {
      const now = new Date().toISOString();
      const results: CollectorResult[] = [];

      for (const sub of niche.subreddits) {
        let subscribers: number | null = null;
        try {
          const about = await getJson<AboutResponse>(`/r/${sub}/about`);
          subscribers = about.data?.subscribers ?? null;
        } catch {
          // Abone sayısı alınamazsa skor tabana düşer, akış durmaz.
        }

        const listing = await getJson<ListingResponse>(
          `/r/${sub}/top?t=${opts.timeframe}&limit=${opts.perSubreddit}`,
        );

        for (const child of listing.data?.children ?? []) {
          const p = child.data;
          if (p.over_18 || p.stickied) continue;

          const item: TrendItem = {
            id: `reddit:${p.id}`,
            platform: 'reddit',
            nativeId: p.id,
            url: `https://www.reddit.com${p.permalink}`,
            title: p.title,
            caption: (p.selftext ?? '').slice(0, 1000),
            authorId: `r/${sub}`,
            authorName: `r/${sub} · u/${p.author}`,
            authorFollowers: subscribers,
            postedAt: new Date(p.created_utc * 1000).toISOString(),
            durationSec: null,
            hashtags: [],
            niche: niche.key,
            matchedQuery: `r/${sub}`,
            firstSeenAt: now,
          };

          results.push({
            item,
            metrics: { views: p.ups, likes: p.ups, comments: p.num_comments },
          });
        }
      }

      return results;
    },
  };
}
