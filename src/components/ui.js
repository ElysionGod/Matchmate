// src/components/ui.js
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

/** DM embed sent to the smasher, showing the poster's details + image */
export function buildRevealEmbed(profile, ownerUser, imageUrl) {
  return new EmbedBuilder()
    .setTitle("You smashed this profile! 🔥")
    .setDescription(
      `**Name:** ${profile.name}\n` +
      `**Age:** ${profile.age}\n` +
      `**City:** ${profile.city}\n` +
      `**Bio:** ${profile.bio}\n\n` +
      `**User Tag:** ${ownerUser?.tag ?? "(unknown)"}\n` +
      `**Mention:** ${ownerUser ? `<@${ownerUser.id}>` : "N/A"}`
    )
    .setImage(imageUrl)
    .setTimestamp();
}

/** Row with a single Link button to DM the poster directly */
export function buildDMRow(posterId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Send Direct Message")
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/users/${posterId}`)
  );
}
