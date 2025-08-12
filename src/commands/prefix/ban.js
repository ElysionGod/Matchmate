// src/commands/prefix/ban.js
import { WebhookClient, EmbedBuilder } from "discord.js";
import { banUser } from "../../services/banManager.js";
import { CONFIG } from "../../config.js";

export default {
  name: "ban",
  ownerOnly: true,
  async run(client, message, args) {
    // Resolve target: mention > ID > tag
    const raw = args[0];
    const reason = args.slice(1).join(" ") || "No reason provided";

    const target =
      message.mentions.users.first() ||
      (raw && /^\d+$/.test(raw) && (await client.users.fetch(raw).catch(() => null))) ||
      client.users.cache.find(u => u.tag?.toLowerCase() === String(raw).toLowerCase());

    if (!target) return message.reply("User not found. Use a mention, ID, or exact tag (Name#1234).");

    // Ban in your DB
    banUser(target.id);
    await message.reply(`🚫 Banned <@${target.id}> from using the bot.${reason ? ` Reason: ${reason}` : ""}`);

    // Webhook log (if configured)
    const url = CONFIG?.webhooks?.banLog;
    if (!url) return; // silently skip if not configured

    const embed = new EmbedBuilder()
      .setTitle("🚫 User Banned")
      .setColor(0xff0000)
      .setDescription(`A user has been banned from using the bot.`)
      .addFields(
        { name: "User", value: `<@${target.id}>\n\`${target.tag}\` • \`${target.id}\``, inline: true },
        { name: "Banned By", value: `<@${message.author.id}>\n\`${message.author.tag}\``, inline: true },
        { name: "Reason", value: reason, inline: true }
      )
      .setTimestamp();

    try {
      const webhook = new WebhookClient({ url });
      await webhook.send({ embeds: [embed] });
    } catch {
      try { await message.channel.send("⚠️ User banned, but failed to send webhook log."); } catch {}
    }
  }
};
