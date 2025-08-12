// src/db/sqlite.js
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "data.sqlite");
const db = new Database(dbPath);

/* ======================
   Schema (safe to re-run)
   ====================== */
db.exec(`
CREATE TABLE IF NOT EXISTS posts (
  message_id   TEXT PRIMARY KEY,
  owner_id     TEXT NOT NULL,
  name         TEXT,
  age          TEXT,
  city         TEXT,
  bio          TEXT,
  image_url    TEXT,
  smash_count  INTEGER DEFAULT 0,
  reject_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS smashes (
  poster_id  TEXT NOT NULL,
  smasher_id TEXT NOT NULL,
  post_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (poster_id, smasher_id)
);

CREATE TABLE IF NOT EXISTS votes (
  voter_id TEXT PRIMARY KEY,
  choice   TEXT CHECK(choice IN ('smash','reject'))
);

CREATE TABLE IF NOT EXISTS bans (
  user_id    TEXT PRIMARY KEY,
  banned     INTEGER NOT NULL DEFAULT 1,
  reason     TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS premium (
  user_id    TEXT PRIMARY KEY,
  tier       TEXT,            -- 'prime' or 'platinum'
  expires_at INTEGER          -- NULL = no expiry (ms epoch)
);

CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id          TEXT PRIMARY KEY,
  panel_channel_id  TEXT,
  post_channel_id   TEXT
);

CREATE TABLE IF NOT EXISTS quotas (
  user_id TEXT PRIMARY KEY,
  date    TEXT NOT NULL,      -- YYYY-MM-DD
  count   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pins (
  message_id TEXT PRIMARY KEY,
  unpin_at   INTEGER NOT NULL -- ms epoch
);

/* Links from root post → every copy (including the root itself) */
CREATE TABLE IF NOT EXISTS post_links (
  root_id    TEXT NOT NULL,
  message_id TEXT PRIMARY KEY
);
`);

/* =============
   Posts / Counts
   ============= */
const _insertOrReplacePost = db.prepare(`
  INSERT OR REPLACE INTO posts
    (message_id, owner_id, name, age, city, bio, image_url, smash_count, reject_count)
  VALUES
    (@message_id, @owner_id, @name, @age, @city, @bio, @image_url, @smash_count, @reject_count)
`);
export const dbCreatePost = _insertOrReplacePost;
export const dbAddPost    = _insertOrReplacePost;

export const dbGetPost = db.prepare(`SELECT * FROM posts WHERE message_id = ?`);

export const dbUpdateCounts = db.prepare(`
  UPDATE posts
  SET smash_count = smash_count + ?, reject_count = reject_count + ?
  WHERE message_id = ?
`);

/* =========
   Smashes
   ========= */
export const dbRecordSmash = db.prepare(`
  INSERT OR IGNORE INTO smashes (poster_id, smasher_id, post_id, created_at)
  VALUES (?, ?, ?, strftime('%s','now') * 1000)
`);
export const dbHasSmashed = db.prepare(`
  SELECT 1 FROM smashes WHERE poster_id = ? AND smasher_id = ? LIMIT 1
`);

/* =====
   Votes
   ===== */
export const dbHasVoted = db.prepare(`SELECT choice FROM votes WHERE voter_id = ?`);
export const dbAddVote  = db.prepare(`INSERT INTO votes (voter_id, choice) VALUES (?, ?)`);

/* ====
   Bans
   ==== */
export const dbBanSet = db.prepare(`
  INSERT OR REPLACE INTO bans (user_id, banned, reason, created_at)
  VALUES (?, 1, ?, strftime('%s','now') * 1000)
`);
export const dbBanUnset = db.prepare(`DELETE FROM bans WHERE user_id = ?`);
export const dbIsBanned = db.prepare(`SELECT 1 FROM bans WHERE user_id = ? AND banned = 1`);

/* ========
   Premium
   ======== */
export const dbSetPremium = db.prepare(`
  INSERT OR REPLACE INTO premium (user_id, tier, expires_at)
  VALUES (?, ?, ?)
`);
export const dbGetPremium = db.prepare(`SELECT * FROM premium WHERE user_id = ?`);
export const dbRemovePremium = db.prepare(`DELETE FROM premium WHERE user_id = ?`);
export const dbAllExpired = db.prepare(`
  SELECT user_id, tier FROM premium
  WHERE expires_at IS NOT NULL AND expires_at <= ?
`);

/* ===============
   Guild settings
   =============== */
export const dbSetSettings = db.prepare(`
  INSERT INTO guild_settings (guild_id, panel_channel_id, post_channel_id)
  VALUES (?, ?, ?)
  ON CONFLICT(guild_id) DO UPDATE SET
    panel_channel_id = excluded.panel_channel_id,
    post_channel_id  = excluded.post_channel_id
`);
export const dbGetSettings = db.prepare(`SELECT * FROM guild_settings WHERE guild_id = ?`);
export const dbAllGuildsWithPost = db.prepare(`SELECT guild_id FROM guild_settings WHERE post_channel_id IS NOT NULL`);

/* ======
   Quotas
   ====== */
export const dbGetQuota = db.prepare(`
  SELECT count FROM quotas WHERE user_id = ? AND date = ?
`);
export const dbIncQuota = db.prepare(`
  INSERT INTO quotas (user_id, date, count)
  VALUES (?, ?, 1)
  ON CONFLICT(user_id) DO UPDATE SET
    count = count + 1,
    date  = excluded.date
`);

/* ====
   Pins
   ==== */
export const dbAddPin       = db.prepare(`INSERT OR REPLACE INTO pins (message_id, unpin_at) VALUES (?, ?)`);
export const dbAllDueUnpins = db.prepare(`SELECT message_id FROM pins WHERE unpin_at <= ?`);
export const dbDueUnpins    = dbAllDueUnpins; // alias if your index.js imports this name
export const dbRemovePin    = db.prepare(`DELETE FROM pins WHERE message_id = ?`);

/* ===========
   Post links
   =========== */
export const dbLinkPost           = db.prepare(`INSERT OR REPLACE INTO post_links (root_id, message_id) VALUES (?, ?)`);
export const dbGetRootFromMessage = db.prepare(`SELECT root_id FROM post_links WHERE message_id = ?`);
export const dbGetAllLinked       = db.prepare(`SELECT message_id FROM post_links WHERE root_id = ?`);

/* Expose connection (optional) */
export { db };
export default db;
