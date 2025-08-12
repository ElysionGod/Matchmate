// src/commands/prefix/removeplatinum.js
import { WebhookClient, EmbedBuilder } from "discord.js";
import { revokePremium } from "../../services/premiumManager.js";
import { CONFIG } from "../../config.js";

/**
 * Sends Platinum removal log to webhook
 * @param {object} client Discord client
 * @param {object} target Discord User
 * @param {string} removedBy ID of user who removed, or null for auto expiry
 * @param {string} reason Optional reason (e.g., "Expired", "Manual removal")
 */
async function sendPlatinumRemovalLog(client, target, removedBy = null, reason = "Manual removal") {
  const url = CONFIG?.webhooks?.removeplat;
  if (!url) return; // No webhook configured

  const removerMention = removedBy ? `<@${removedBy}>` : "System (Auto)";
  const removerTag = removedBy
    ? (await client.users.fetch(removedBy).catch(() => null))?.tag ?? "(unknown)"
    : "System";

  const embed = new EmbedBuilder()
    .setTitle("💎 Platinum Removed")
    .setColor(0xE5E4E2) // Platinum color
    .setDescription(`Platinum membership was removed from <@${target.id}>.`)
    .addFields(
      { name: "User", value: `<@${target.id}>\n\`${target.tag}\` • \`${target.id}\``, inline: true },
      { name: "Removed By", value: `${removerMention}\n\`${removerTag}\``, inline: true },
      { name: "Reason", value: reason, inline: true }
    )
    .setTimestamp();

  try {
    const webhook = new WebhookClient({ url });
    await webhook.send({ embeds: [embed] });
  } catch (err) {
    console.error("Failed to send Platinum removal webhook:", err);
  }
}

export default {
  name: "removeplatinum",
  ownerOnly: true,
  async run(client, message, args) {
    const target =
      message.mentions.users.first() ||
      (args[0] && await client.users.fetch(args[0]).catch(() => null));

    if (!target) return message.reply("User not found.");

    revokePremium(target.id); // Remove from database / cache
    message.reply(`❌ Removed **Platinum** from <@${target.id}>`);

    // Send webhook log
    await sendPlatinumRemovalLog(client, target, message.author.id, "Manual removal");
  }
};

// ✅ Export so we can reuse this in your auto-expire logic
export { sendPlatinumRemovalLog };
