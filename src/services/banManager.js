// src/services/banManager.js
import { dbBanSet, dbBanUnset, dbIsBanned } from "../db/sqlite.js";

/** Ban a user from using the bot. */
export function banUser(userId) {
  dbBanSet.run(userId);
}

/** Unban a user (if you ever need it). */
export function unbanUser(userId) {
  dbBanUnset.run(userId);
}

/** Check if a user is banned. */
export function isBanned(userId) {
  return !!dbIsBanned.get(userId)?.banned;
}
