// src/events/client/guildDelete.js
import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../../config.js";
import fetch from "node-fetch"; // make sure node-fetch is installed

export default {
  name: "guildDelete",
  once: false,
  async execute(guild) {
    const embed = new EmbedBuilder()
      .setTitle("👋 Bot Removed from Server")
      .setColor("Red")
      .addFields(
        { name: "Server", value: `${guild.name} (\`${guild.id}\`)`, inline: false },
        { name: "Members at Leave", value: `${guild.memberCount || "Unknown"}`, inline: true }
      )
      .setTimestamp();

    const webhookUrl = CONFIG?.webhooks?.guildLeave;
    if (!webhookUrl) {
      return console.warn("[GUILD LEAVE] No webhook configured in config.json");
    }

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed.toJSON()] }),
      });
      console.log(`[LOG] Left guild: ${guild.name} (${guild.id})`);
    } catch (err) {
      console.error("[WEBHOOK ERROR] Failed to send guild leave embed:", err);
    }
  }
};
