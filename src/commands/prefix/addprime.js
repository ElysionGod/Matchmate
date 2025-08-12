// src/commands/prefix/addprime.js
import { WebhookClient, EmbedBuilder } from "discord.js";
import { grantPremium } from "../../services/premiumManager.js";
import { CONFIG } from "../../config.js";

function fmtDuration(d) {
  return d ? d : "no expiry";
}

export default {
  name: "addprime",
  ownerOnly: true,
  async run(client, message, args) {
    // Resolve user: mention > ID > tag
    const raw = args[0];
    const duration = args[1] || null;

    let target =
      message.mentions.users.first() ||
      (raw && /^\d+$/.test(raw) && (await client.users.fetch(raw).catch(() => null))) ||
      client.users.cache.find(u => u.tag?.toLowerCase() === String(raw).toLowerCase());

    if (!target) {
      return message.reply("User not found. Use a mention, ID, or exact tag (Name#1234).");
    }

    // Grant Prime
    grantPremium(target.id, "prime", duration);
    await message.reply(`✅ Granted **Prime** to <@${target.id}> ${duration ? `for ${duration}` : "forever"}.`);

    // Send webhook log (if configured)
    const url = CONFIG?.webhooks?.primeLog;
    if (!url) return; // skip if no webhook

    const giverMention = `<@${message.author.id}>`;
    const targetMention = `<@${target.id}>`;

    const embed = new EmbedBuilder()
      .setTitle("✨ Prime Granted")
      .setColor(0xFFD700) // Gold color for Prime
      .setDescription(`${targetMention} just received **Prime** status!`)
      .addFields(
        { name: "User", value: `${targetMention}\n\`${target.tag}\` • \`${target.id}\``, inline: true },
        { name: "Granted By", value: `${giverMention}\n\`${message.author.tag}\``, inline: true },
        { name: "Duration", value: fmtDuration(duration), inline: true }
      )
      .setTimestamp();

    try {
      const webhook = new WebhookClient({ url });
      await webhook.send({ embeds: [embed] });
    } catch (e) {
      try { await message.channel.send("⚠️ Prime granted, but failed to send webhook log."); } catch {}
    }
  }
};
