// src/components/panel.js
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { CONFIG } from "../config.js"; // ⬅️ add this line

export function tryLuckRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("startPost")
      .setEmoji("1404827796764627064")
      .setLabel("Try Your Luck")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setEmoji("1404827824216477707")
      .setLabel("Support Server")
      .setStyle(ButtonStyle.Link)
      .setURL(CONFIG.supportServer || "https://discord.gg/DZavZ8XDZk"),
    new ButtonBuilder()
      .setEmoji("1404827814435229746")
      .setLabel("Check my premium")
      .setStyle(ButtonStyle.Link)
      .setURL(CONFIG.supportServer || "https://discord.gg/YWAq8DPbd8")
  );
}
