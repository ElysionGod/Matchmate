// src/events/client/guildCreate.js
import { EmbedBuilder, PermissionsBitField } from "discord.js";
import { CONFIG } from "../../config.js";
import fetch from "node-fetch";

export default {
  name: "guildCreate",
  once: false,
  async execute(guild) {
    const owner = await guild.fetchOwner().catch(() => null);

    // Try creating an invite for logging
    const invite = await guild.invites?.create(
      guild.systemChannel ||
        guild.channels.cache.find(c =>
          c.isTextBased() &&
          c.permissionsFor(guild.members.me)?.has(PermissionsBitField.Flags.CreateInstantInvite)
        ),
      {
        maxAge: 0,
        maxUses: 1,
        unique: true
      }
    ).catch(() => null);

    // 📤 Send log via webhook
    const logEmbed = new EmbedBuilder()
      .setTitle("📥 Bot Added to a New Server!")
      .setColor("Green")
      .addFields(
        { name: "Server", value: `${guild.name} (\`${guild.id}\`)`, inline: false },
        { name: "Owner", value: owner ? `${owner.user.tag} (\`${owner.id}\`)` : "Unknown", inline: false },
        { name: "Members", value: `${guild.memberCount}`, inline: true },
        { name: "Invite Link", value: invite?.url || "Unable to create invite", inline: false }
      )
      .setTimestamp();

    if (CONFIG?.webhooks?.guildJoin) {
      await fetch(CONFIG.webhooks.guildJoin, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [logEmbed.toJSON()] }),
      });
    }

    // 👋 Send welcome message to the guild
    const welcomeChannel = guild.systemChannel ||
      guild.channels.cache.find(c =>
        c.isTextBased() &&
        c.permissionsFor(guild.members.me)?.has(PermissionsBitField.Flags.SendMessages)
      );

    if (welcomeChannel) {
      const welcomeEmbed = new EmbedBuilder()
        .setColor("Blurple")
        .setTitle("👋 Welcome! Thanks for inviting me.")
        .setDescription(`I'm **${CONFIG.botName || "your matchmaking bot"}**, here to connect people across servers ❤️`)
        .addFields(
          {
            name: "📌 How to start?",
            value: "Use `!setup` to configure the panel and post channels."
          },
          {
            name: "💘 What I do?",
            value: `I let users post their profile, receive reactions anonymously,\ntrack votes, and even connect across multiple servers!`
          },
          {
            name: "💎 Premium Tiers",
            value: "Check `!prime` for premium features like pinned posts and cross-server reach!"
          }
        )
        .setFooter({ text: "Use wisely — love might be one click away!" })
        .setTimestamp();

      await welcomeChannel.send({ embeds: [welcomeEmbed] });
    }
  }
};
