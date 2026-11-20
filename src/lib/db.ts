import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type DB = Database.Database;

export const DEFAULT_DB_PATH = resolve(process.cwd(), 'data/creator.db');

export function openDb(path = DEFAULT_DB_PATH): DB {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

const globalForDb = globalThis as unknown as { __creatorDb?: DB };

/** Süreç başına tek bağlantı. Next dev HMR modülleri yeniden yüklese de çoğalmaz. */
export function db(): DB {
  globalForDb.__creatorDb ??= openDb();
  return globalForDb.__creatorDb;
}

export function nowIso(): string {
  return new Date().toISOString();
}

function migrate(db: DB): void {
  db.exec(`
    -- ── Trend Radar (content-research) tabloları — aynen ────────────────
    CREATE TABLE IF NOT EXISTS items (
      id               TEXT PRIMARY KEY,
      platform         TEXT NOT NULL,
      native_id        TEXT NOT NULL,
      url              TEXT NOT NULL,
      title            TEXT NOT NULL,
      caption          TEXT NOT NULL DEFAULT '',
      author_id        TEXT NOT NULL,
      author_name      TEXT NOT NULL,
      author_followers INTEGER,
      posted_at        TEXT NOT NULL,
      duration_sec     INTEGER,
      hashtags         TEXT NOT NULL DEFAULT '[]',
      niche            TEXT NOT NULL,
      matched_query    TEXT NOT NULL DEFAULT '',
      first_seen_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_items_niche     ON items(niche);
    CREATE INDEX IF NOT EXISTS idx_items_posted    ON items(posted_at);
    CREATE INDEX IF NOT EXISTS idx_items_platform  ON items(platform);

    -- Aynı videoyu her koşuda tekrar ölçüyoruz. İvme buradan çıkıyor.
    CREATE TABLE IF NOT EXISTS metric_snapshots (
      item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      captured_at TEXT NOT NULL,
      views       INTEGER NOT NULL,
      likes       INTEGER NOT NULL,
      comments    INTEGER NOT NULL,
      PRIMARY KEY (item_id, captured_at)
    );
    CREATE INDEX IF NOT EXISTS idx_snap_item ON metric_snapshots(item_id, captured_at);

    CREATE TABLE IF NOT EXISTS surfaced (
      item_id     TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
      surfaced_at TEXT NOT NULL,
      dismissed   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS runs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      collector  TEXT NOT NULL,
      niche      TEXT NOT NULL,
      found      INTEGER NOT NULL,
      error      TEXT
    );

    -- ── Nişler ve kanallar (bir kanal = tek niş) ─────────────────────────
    CREATE TABLE IF NOT EXISTS niches (
      key         TEXT PRIMARY KEY,
      label       TEXT NOT NULL,
      region_code TEXT,
      queries     TEXT NOT NULL DEFAULT '[]',
      subreddits  TEXT NOT NULL DEFAULT '[]',
      hashtags    TEXT NOT NULL DEFAULT '[]',
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS channels (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      platform         TEXT NOT NULL CHECK (platform IN ('youtube','instagram','tiktok')),
      handle           TEXT NOT NULL,
      url              TEXT NOT NULL DEFAULT '',
      niche_key        TEXT NOT NULL REFERENCES niches(key),
      native_id        TEXT,
      status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','retired')),
      yt_refresh_token TEXT,
      created_at       TEXT NOT NULL,
      UNIQUE (platform, handle)
    );

    CREATE TABLE IF NOT EXISTS channel_metrics (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id  INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      captured_at TEXT NOT NULL,
      followers   INTEGER NOT NULL,
      total_views INTEGER,
      video_count INTEGER,
      source      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chm_channel ON channel_metrics(channel_id, captured_at);

    -- ── Viral referanslar ve deneyler ────────────────────────────────────
    CREATE TABLE IF NOT EXISTS viral_refs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      url         TEXT NOT NULL DEFAULT '',
      platform    TEXT NOT NULL DEFAULT '',
      niche_key   TEXT NOT NULL REFERENCES niches(key),
      title       TEXT NOT NULL DEFAULT '',
      transcript  TEXT NOT NULL DEFAULT '',
      notes       TEXT NOT NULL DEFAULT '',
      analysis_md TEXT NOT NULL DEFAULT '',
      item_id     TEXT REFERENCES items(id) ON DELETE SET NULL,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS experiments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      hypothesis TEXT NOT NULL,
      variable   TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','won','lost','inconclusive')),
      verdict_md TEXT NOT NULL DEFAULT '',
      started_at TEXT NOT NULL,
      ended_at   TEXT
    );

    -- ── İçerik hattı ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS contents (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id        INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      title             TEXT NOT NULL,
      format            TEXT NOT NULL CHECK (format IN ('short','long','reel','carousel','post','story')),
      status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('idea','draft','approved','produced','published','measured')),
      hook              TEXT NOT NULL DEFAULT '',
      script_md         TEXT NOT NULL DEFAULT '',
      caption           TEXT NOT NULL DEFAULT '',
      hashtags          TEXT NOT NULL DEFAULT '[]',
      viral_ref_id      INTEGER REFERENCES viral_refs(id) ON DELETE SET NULL,
      parent_content_id INTEGER REFERENCES contents(id) ON DELETE SET NULL,
      experiment_id     INTEGER REFERENCES experiments(id) ON DELETE SET NULL,
      published_url     TEXT,
      platform_post_id  TEXT,
      published_at      TEXT,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_contents_channel ON contents(channel_id, status);

    CREATE TABLE IF NOT EXISTS content_metrics (
      content_id            INTEGER NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
      captured_at           TEXT NOT NULL,
      views                 INTEGER NOT NULL,
      likes                 INTEGER NOT NULL,
      comments              INTEGER NOT NULL,
      shares                INTEGER,
      saves                 INTEGER,
      avg_view_duration_sec REAL,
      avg_view_pct          REAL,
      subs_gained           INTEGER,
      source                TEXT NOT NULL CHECK (source IN ('youtube_api','youtube_analytics','ytdlp','manual')),
      PRIMARY KEY (content_id, captured_at, source)
    );

    CREATE TABLE IF NOT EXISTS creatives (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      content_id   INTEGER NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
      kind         TEXT NOT NULL CHECK (kind IN ('image','video','thumbnail')),
      purpose      TEXT NOT NULL CHECK (purpose IN ('organic','ad')),
      tool         TEXT NOT NULL CHECK (tool IN ('higgsfield','hyperframes','manual')),
      prompt       TEXT NOT NULL DEFAULT '',
      file_path    TEXT,
      remote_url   TEXT,
      aspect_ratio TEXT NOT NULL,
      created_at   TEXT NOT NULL
    );

    -- ── Finans. Tam kart no / CVV / SKT / şifre için sütun YOK, eklenmez. ─
    CREATE TABLE IF NOT EXISTS cards (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      bank          TEXT NOT NULL CHECK (bank IN ('yapikredi','enpara','other')),
      nickname      TEXT NOT NULL,
      last4         TEXT NOT NULL CHECK (length(last4) = 4),
      limit_try     REAL,
      statement_day INTEGER CHECK (statement_day BETWEEN 1 AND 31),
      due_day       INTEGER CHECK (due_day BETWEEN 1 AND 31)
    );

    CREATE TABLE IF NOT EXISTS statements (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id      INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      file_path    TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end   TEXT NOT NULL,
      total        REAL NOT NULL,
      imported_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      occurred_on  TEXT NOT NULL,
      amount       REAL NOT NULL,
      currency     TEXT NOT NULL DEFAULT 'TRY',
      merchant     TEXT NOT NULL,
      category     TEXT NOT NULL,
      card_id      INTEGER REFERENCES cards(id) ON DELETE SET NULL,
      channel_id   INTEGER REFERENCES channels(id) ON DELETE SET NULL,
      note         TEXT NOT NULL DEFAULT '',
      source       TEXT NOT NULL CHECK (source IN ('manual','statement')),
      statement_id INTEGER REFERENCES statements(id) ON DELETE SET NULL,
      dedupe_key   TEXT NOT NULL UNIQUE
    );
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(occurred_on);

    -- ── Agent raporları ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS reports (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      kind         TEXT NOT NULL CHECK (kind IN ('weekly','postmortem','algorithm','finance')),
      channel_id   INTEGER REFERENCES channels(id) ON DELETE SET NULL,
      period_start TEXT,
      period_end   TEXT,
      title        TEXT NOT NULL,
      body_md      TEXT NOT NULL,
      created_at   TEXT NOT NULL
    );
  `);
}
