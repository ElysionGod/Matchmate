// src/components/modals.js
import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";

/** Modal shown when user clicks "Try Your Luck" */
export function buildAppFormModal() {
  const modal = new ModalBuilder()
    .setCustomId("appForm")
    .setTitle("💘 Fill this to post your profile");

  const name = new TextInputBuilder()
    .setCustomId("name")
    .setLabel("Your Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(32);

  const age = new TextInputBuilder()
    .setCustomId("age")
    .setLabel("Your Age (Numbers Only)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(2);

  const city = new TextInputBuilder()
    .setCustomId("city")
    .setLabel("Where Do You Live?")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(32);

  const bio = new TextInputBuilder()
    .setCustomId("bio")
    .setLabel("Tell Us About Yourself")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(300);

  modal.addComponents(
    new ActionRowBuilder().addComponents(name),
    new ActionRowBuilder().addComponents(age),
    new ActionRowBuilder().addComponents(city),
    new ActionRowBuilder().addComponents(bio),
  );

  return modal;
}
