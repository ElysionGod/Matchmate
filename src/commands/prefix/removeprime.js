// src/commands/prefix/removeprime.js
import { WebhookClient, EmbedBuilder } from "discord.js";
import { revokePremium } from "../../services/premiumManager.js";
import { CONFIG } from "../../config.js";

export default {
  name: "removeprime",
  ownerOnly: true,
  async run(client, message, args) {
    // Resolve user: mention > ID > tag
    const raw = args[0];
    const target =
      message.mentions.users.first() ||
      (raw && /^\d+$/.test(raw) && (await client.users.fetch(raw).catch(() => null))) ||
      client.users.cache.find(u => u.tag?.toLowerCase() === String(raw).toLowerCase());

    if (!target) return message.reply("User not found. Use a mention, ID, or exact tag (Name#1234).");

    // Remove premium (no client passed to avoid double webhook; we'll send our own log below)
    revokePremium(target.id);

    await message.reply(`❌ Removed **Prime** from <@${target.id}>`);

    // Send webhook log to the Prime log room (if configured)
    const url = CONFIG?.webhooks?.removedprime;
    if (!url) return; // silently skip if no webhook configured

    const embed = new EmbedBuilder()
      .setTitle("removedpremium") // <- requested name
      .setColor(0xFFD700)         // gold for prime
      .setDescription(`Prime membership was removed from <@${target.id}>.`)
      .addFields(
        { name: "User", value: `<@${target.id}>\n\`${target.tag}\` • \`${target.id}\``, inline: true },
        { name: "Removed By", value: `<@${message.author.id}>\n\`${message.author.tag}\``, inline: true },
        { name: "Reason", value: "Manual removal", inline: true }
      )
      .setTimestamp();

    try {
      const webhook = new WebhookClient({ url });
      await webhook.send({ embeds: [embed] });
    } catch {
      try { await message.channel.send("⚠️ Prime removed, but failed to send webhook log."); } catch {}
    }
  }
};
