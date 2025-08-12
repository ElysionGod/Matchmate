// src/services/postLogger.js
import { WebhookClient, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { CONFIG } from "../config.js";

/**
 * Create (or fetch) a server invite the bot can share in logs.
 * Tries:
 *   1) The message's own channel
 *   2) Any text channel where the bot has CreateInstantInvite
 *   3) Vanity URL (if the guild has one)
 * Returns a URL string or "No invite available".
 */
async function getServerInviteURL(message) {
  try {
    const guild = message?.guild;
    if (!guild) return "No invite available";

    // Prefer the channel where the post was sent
    const tryCreateIn = async (channel) => {
      try {
        if (
          channel &&
          typeof channel.createInvite === "function" &&
          channel.isTextBased?.()
        ) {
          const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
          if (!me) return null;

          const perms = channel.permissionsFor(me);
          if (perms?.has(PermissionFlagsBits.CreateInstantInvite)) {
            const invite = await channel.createInvite({
              maxAge: 0,     // never expire
              maxUses: 0,    // unlimited
              temporary: false,
              unique: true,
              reason: "Posting log: server invite",
            });
            return invite?.url ?? null;
          }
        }
        return null;
      } catch {
        return null;
      }
    };

    // 1) This message's channel
    const chInvite = await tryCreateIn(message.channel);
    if (chInvite) return chInvite;

    // 2) Any other text channel
    for (const [, ch] of guild.channels.cache) {
      const url = await tryCreateIn(ch);
      if (url) return url;
    }

    // 3) Vanity URL fallback (requires server feature)
    try {
      // If the bot lacks MANAGE_GUILD this may still work when cached
      const code = guild.vanityURLCode || (await guild.fetchVanityData().catch(() => null))?.code;
      if (code) return `https://discord.gg/${code}`;
    } catch {}

    return "No invite available";
  } catch {
    return "No invite available";
  }
}

/**
 * Log every profile post to a webhook (origin or cross-post).
 * @param {{
 *   message: import('discord.js').Message,
 *   user: import('discord.js').User,
 *   profile: { name:string, age:string, city:string, bio:string, imageUrl:string },
 *   tier: 'free'|'prime'|'platinum',
 *   hiddenMode?: boolean,
 *   isCrosspost?: boolean
 * }} opts
 */
export async function sendPostLog({ message, user, profile, tier, hiddenMode = false, isCrosspost = false }) {
  const url = CONFIG?.webhooks?.postLog;
  if (!url) return;

  const webhook = new WebhookClient({ url });

  const title = isCrosspost ? "📣 Cross‑Posted Profile" : "📨 New Profile Post";
  const color =
    tier === "platinum" ? 0xE5E4E2 :
    tier === "prime"    ? 0xF1C40F :
                          0x2B2D31;

  const jump = message?.url ?? "(message link unavailable)";
  const server = message?.guild?.name ?? "Unknown Server";
  const channelMention = message?.channelId ? `<#${message.channelId}>` : "N/A";

  // 🔗 Create (or fetch) an invite for the server
  const inviteUrl = await getServerInviteURL(message);

  const desc =
`| 🪪 **Name:** \`${profile.name}\`
| 🎂 **Age:** \`${profile.age}\`
| 🏙️ **City:** \`${profile.city}\`
| 📖 **About:** \`${profile.bio}\``;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(desc)
    .setImage(profile.imageUrl)
    .addFields(
      {
        name: "User",
        value: `${user ? `<@${user.id}>` : "N/A"}\n\`${user?.tag ?? "unknown"}\` • \`${user?.id ?? "N/A"}\``,
        inline: true,
      },
      {
        name: "Tier",
        value: hiddenMode ? `${tier} • Hidden Mode` : tier,
        inline: true,
      },
      {
        name: "Server",
        value: `${server}`,
        inline: false,
      },
    
      {
        name: "Server Invite",
        value: inviteUrl,
        inline: false,
      }
    )
    .setTimestamp();

  try {
    await webhook.send({ embeds: [embed] });
  } catch (err) {
    console.error("[POST-LOG] failed:", err?.message || err);
  }
}

export default sendPostLog;
