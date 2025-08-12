// src/services/crosspost.js
import { dbAllGuildsWithPost, dbGetSettings, dbLinkPost } from "../db/sqlite.js";
import { isPlatinum } from "./premiumManager.js";
import { CONFIG } from "../config.js";
import { sendPostLog } from "./postLogger.js";

/**
 * Cross‑post a Platinum user's post to all linked guilds' post channels.
 * Records each copy in post_links and logs to webhook.
 *
 * @param {import('discord.js').Client} client
 * @param {string} ownerId
 * @param {string} originGuildId
 * @param {string} rootMessageId
 * @param {{embeds:any[],components:any[],content?:string}} messagePayload
 * @param {{user?:import('discord.js').User, profile?:{name:string,age:string,city:string,bio:string,imageUrl:string}, tier?:'free'|'prime'|'platinum', hiddenMode?:boolean}} [meta]
 */
export async function crossPostIfPlatinum(client, ownerId, originGuildId, rootMessageId, messagePayload, meta = {}) {
  const isPlat = isPlatinum(ownerId);
  if (!isPlat) return;

  // Targets from DB
  let rows = [];
  try { rows = dbAllGuildsWithPost.all(); } catch {}
  let guildIds = rows.map(r => String(r.guild_id)).filter(Boolean);

  // Fallback to CONFIG.linkedGuilds
  if (!guildIds.length && Array.isArray(CONFIG.linkedGuilds) && CONFIG.linkedGuilds.length) {
    guildIds = CONFIG.linkedGuilds.map(String);
  }
  if (!guildIds.length) return;

  for (const gid of guildIds) {
    if (gid === originGuildId) continue;

    try {
      const guild = await client.guilds.fetch(gid).catch(() => null);
      if (!guild) continue;

      const settings = dbGetSettings.get(gid);
      const postChannelId = settings?.post_channel_id;
      if (!postChannelId) continue;

      const channel = await guild.channels.fetch(postChannelId).catch(() => null);
      if (!channel || !channel.isTextBased?.()) continue;

      // Clone payload and mark footer as cross‑posted
      const clone = {
        content: messagePayload.content ?? undefined,
        embeds: (messagePayload.embeds || []).map((e) => {
          const raw = e.data ?? e;
          const footerText = raw.footer?.text ? `${raw.footer.text} • Cross-posted` : "Cross-posted";
          return { ...raw, footer: { text: footerText } };
        }),
        components: messagePayload.components || [],
      };

      const copy = await channel.send(clone).catch(() => null);
      if (!copy) continue;

      // Link copy for cross‑server synced buttons
      try { dbLinkPost.run(rootMessageId, copy.id); } catch {}

      // Log the copy if meta provided
      if (meta?.user && meta?.profile) {
        try {
          await sendPostLog({
            message: copy,
            user: meta.user,
            profile: meta.profile,
            tier: meta.tier ?? "platinum",
            hiddenMode: !!meta.hiddenMode,
            isCrosspost: true,
          });
        } catch {}
      }
    } catch {
      // continue on errors per guild
    }
  }
}

export default crossPostIfPlatinum;
