// src/services/premiumManager.js
import {
  dbSetPremium,
  dbGetPremium,
  dbRemovePremium,
  dbAllExpired,
} from "../db/sqlite.js";
import { parseDuration, now } from "../utils/time.js";
import { STATUSES } from "../constants.js";
import { log } from "../utils/logger.js";
import { CONFIG } from "../config.js";
import { WebhookClient, EmbedBuilder } from "discord.js";

/**
 * Internal helper — send webhook logs
 */
async function sendPremiumLog({ type, action, targetId, targetTag, expiresAt, reason = "Manual" }) {
  const isPlatinum = type === STATUSES.PLATINUM;
  const webhookUrl = isPlatinum ? CONFIG.webhooks?.removeplat : CONFIG.webhooks?.removedprime;
  if (!webhookUrl) return;

  const embed = new EmbedBuilder()
    .setTitle(
      `${isPlatinum ? "💎 Platinum" : "✨ Prime"} ${action === "grant" ? "Granted" : "Removed"}`
    )
    .setColor(isPlatinum ? 0xE5E4E2 : 0xFFD700)
    .addFields(
      { name: "User", value: `<@${targetId}>\n\`${targetTag}\``, inline: true },
      { name: "Reason", value: reason, inline: true }
    )
    .setTimestamp();

  if (expiresAt) {
    embed.addFields({
      name: "Expires At",
      value: `<t:${Math.floor(expiresAt / 1000)}:F>`,
      inline: true,
    });
  }

  try {
    const webhook = new WebhookClient({ url: webhookUrl });
    await webhook.send({ embeds: [embed] });
  } catch (err) {
    console.error(`Failed to send ${type} ${action} webhook:`, err);
  }
}

/**
 * Grant Prime/Platinum for an optional duration.
 * durationStr examples: "7d", "30d", "12h". If omitted -> no expiry.
 */
export async function grantPremium(userId, tier, durationStr, client = null) {
  tier = String(tier).toLowerCase();
  if (![STATUSES.PRIME, STATUSES.PLATINUM].includes(tier)) {
    throw new Error(`Invalid tier: ${tier} (use "prime" or "platinum")`);
  }

  const durationMs = durationStr ? parseDuration(durationStr) : null;
  const expiresAt = durationMs ? now() + durationMs : null;

  dbSetPremium.run(userId, tier, expiresAt);

  // Send webhook log
  if (client) {
    const u = await client.users.fetch(userId).catch(() => null);
    if (u) {
      await sendPremiumLog({
        type: tier,
        action: "grant",
        targetId: userId,
        targetTag: u.tag,
        expiresAt,
      });
    }
  }

  return { userId, tier, expiresAt };
}

export const givePremium = grantPremium;

/**
 * Remove any premium record for the user (Prime or Platinum).
 */
export async function revokePremium(userId, reason = "Manual", client = null) {
  const p = getPremium(userId);
  if (!p) return;

  dbRemovePremium.run(userId);

  // Send webhook log
  if (client) {
    const u = await client.users.fetch(userId).catch(() => null);
    if (u) {
      await sendPremiumLog({
        type: p.tier,
        action: "remove",
        targetId: userId,
        targetTag: u.tag,
        reason,
      });
    }
  }
}

export const removePremium = revokePremium;

/** Get the user's premium row, or null. */
export function getPremium(userId) {
  const row = dbGetPremium.get(userId);
  return row || null;
}

/** True if the user is Prime (or Platinum, which includes Prime benefits). */
export function isPrime(userId) {
  const p = getPremium(userId);
  return p?.tier === STATUSES.PRIME || p?.tier === STATUSES.PLATINUM;
}

/** True only if the user is Platinum. */
export function isPlatinum(userId) {
  const p = getPremium(userId);
  return p?.tier === STATUSES.PLATINUM;
}

/**
 * Background job that auto-removes expired premium
 * and sends webhook logs with reason "Expired".
 */
export function startExpirySweep(client) {
  setInterval(async () => {
    const expired = dbAllExpired.all(now());
    for (const row of expired) {
      try {
        await revokePremium(row.user_id, "Expired", client);
        const u = await client.users.fetch(row.user_id).catch(() => null);
        if (u) await u.send(`Your **${row.tier}** membership has expired.`);
      } catch (err) {
        console.error("Error handling expiry:", err);
      }
    }
  }, 60 * 1000); // every minute
  log("Premium expiry sweep started.");
}
