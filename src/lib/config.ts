import type { NicheConfig } from './trend/types';
import { db } from './db';
import { listNiches } from './repo/niches';

export type AppConfig = {
  youtubeApiKey: string;
  redditClientId: string;
  redditClientSecret: string;
  youtubeOauthClientId: string;
  youtubeOauthClientSecret: string;
  /** yt-dlp --cookies-from-browser değeri (Instagram/TikTok için). */
  ytdlpCookiesBrowser: string;
  niches: NicheConfig[];
  lookbackHours: number;
  perQuery: number;
};

/** Ortam değişkenleri `.env.local`'dan; CLI/MCP girişleri dotenv ile yükler, Next kendisi yükler. */
export function loadConfig(): AppConfig {
  return {
    youtubeApiKey: process.env.YOUTUBE_API_KEY ?? '',
    redditClientId: process.env.REDDIT_CLIENT_ID ?? '',
    redditClientSecret: process.env.REDDIT_CLIENT_SECRET ?? '',
    youtubeOauthClientId: process.env.YOUTUBE_OAUTH_CLIENT_ID ?? '',
    youtubeOauthClientSecret: process.env.YOUTUBE_OAUTH_CLIENT_SECRET ?? '',
    ytdlpCookiesBrowser: process.env.YTDLP_COOKIES_BROWSER ?? '',
    niches: listNiches(db()),
    lookbackHours: Number(process.env.LOOKBACK_HOURS ?? 168),
    perQuery: Number(process.env.PER_QUERY ?? 25),
  };
}
