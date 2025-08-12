import { CONFIG } from "../config.js";
import { dbGetQuota, dbIncQuota } from "../db/sqlite.js";
const dateKey = () => new Date().toISOString().slice(0,10);

export function canPost(userId, isPrime) {
  if (isPrime) return { ok: true };
  const row = dbGetQuota.get(userId, dateKey());
  const count = row?.count ?? 0;
  const limit = CONFIG.defaults.freeDailyPosts ?? 2;
  if (count >= limit) return { ok: false, reason: `Daily free post limit reached (${limit}).` };
  return { ok: true, used: count };
}

export function recordPost(userId) {
  dbIncQuota.run(userId, dateKey());
}
