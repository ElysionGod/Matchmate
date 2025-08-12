// src/commands/prefix/setup.js
import {
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { dbSetSettings } from "../../db/sqlite.js";
import { panelEmbed } from "../../components/embeds.js";
import { tryLuckRow } from "../../components/panel.js";
import { refreshLinkedGuilds, CONFIG } from "../../config.js";

function canRunSetup(message) {
  const isOwner =
    Array.isArray(CONFIG?.ownerIds) && CONFIG.ownerIds.includes(message.author.id);
  const perms = message.member?.permissions;
  const isAdmin =
    perms?.has(PermissionsBitField.Flags.Administrator) ||
    perms?.has(PermissionsBitField.Flags.ManageGuild);
  return isOwner || isAdmin;
}

async function resolveChannel(guild, token) {
  if (!token) return null;
  const cleaned = token.replace(/[<#>]/g, "");

  const byId = await guild.channels.fetch(cleaned).catch(() => null);
  if (byId) return byId;

  const lowered = token.toLowerCase();
  const cached = guild.channels.cache.find((c) => c.name?.toLowerCase() === lowered);
  if (cached) return cached;

  try {
    const all = await guild.channels.fetch();
    return all.find((c) => c.name?.toLowerCase() === lowered) || null;
  } catch {
    return null;
  }
}

function isTextChannel(ch) {
  return (
    ch?.isTextBased?.() &&
    ch.type !== ChannelType.GuildCategory &&
    ch.type !== ChannelType.GuildDirectory
  );
}

export default {
  name: "setup",
  ownerOnly: false,
  async run(client, message, args) {
    if (!message.guild) {
      return message.reply("⚠️ This command can only be used in a server.");
    }

    const memberCount = message.guild.memberCount || 0;
    const isOwner = CONFIG.ownerIds.includes(message.author.id);

    if (memberCount < 85 && !isOwner) {
      const embed = new EmbedBuilder()
        .setTitle("⛔ Access Restricted")
        .setDescription(
          `This bot is only available for servers with **85 or more members**.\n\nWant to bypass this? Contact us for access.`
        )
        .setColor("Red");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Join Support Server")
          .setStyle(ButtonStyle.Link)
          .setURL(CONFIG.supportServer || "https://discord.gg/Cb7dbTxXPt") // fallback URL
      );

      return message.channel.send({ embeds: [embed], components: [row] });
    }

    if (!canRunSetup(message)) {
      return message.reply(
        "⛔ You need **Administrator** (or Manage Server), or be a configured owner, to run this command."
      );
    }

    if (args.length < 2) {
      return message.reply(
        "Usage: `!setup <panelChannel> <postChannel>` (ID, #mention, or exact name)."
      );
    }

    const panel = await resolveChannel(message.guild, args[0]);
    const post = await resolveChannel(message.guild, args[1]);

    if (!panel || !post || !isTextChannel(panel) || !isTextChannel(post)) {
      return message.reply(
        "❌ I couldn’t resolve both channels as **text channels**. Use a channel ID, #mention, or exact name."
      );
    }

    try {
      dbSetSettings.run(message.guild.id, panel.id, post.id);
      refreshLinkedGuilds();
    } catch (e) {
      console.error("[!setup] dbSetSettings error:", e);
      return message.reply("⚠️ Failed to save setup. Check console for details.");
    }

    await message.reply(`✅ Setup complete!\n• Panel: <#${panel.id}>\n• Post: <#${post.id}>`);

    try {
      await panel.send({
        embeds: [panelEmbed({ postChannelId: post.id })],
        components: [tryLuckRow()],
      });
    } catch (e) {
      console.error("[!setup] Failed to send panel message:", e);
      await message.channel.send(
        "⚠️ Setup saved, but I couldn't send the panel message. Check my **Send Messages**/**Embed Links** permissions in the panel channel."
      );
    }
  },
};
