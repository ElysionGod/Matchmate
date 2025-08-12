// src/commands/slash/setup.js
import {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { dbSetSettings } from "../../db/sqlite.js";
import { refreshLinkedGuilds, CONFIG } from "../../config.js";
import { panelEmbed } from "../../components/embeds.js";
import { tryLuckRow } from "../../components/panel.js";

export const data = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Configure the bot for this server")
  .addChannelOption(option =>
    option
      .setName("panel_channel")
      .setDescription("Channel where the Try Your Luck panel will be posted")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .addChannelOption(option =>
    option
      .setName("post_channel")
      .setDescription("Channel where profiles will be posted")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  );

export async function execute(interaction, client) {
  const member = interaction.member;
  const guild = interaction.guild;
  const userId = interaction.user.id;

  const isOwner = CONFIG.ownerIds.includes(userId);
  const memberCount = guild.memberCount || 0;

  if (memberCount < 85 && !isOwner) {
    const embed = new EmbedBuilder()
      .setColor("Red")
      .setTitle("⛔ Server Too Small")
      .setDescription("This bot is only available for **servers with 85 or more members**.\nIf you'd like access anyway, please contact us.");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("💬 Support Server")
        .setStyle(ButtonStyle.Link)
        .setURL(CONFIG.supportServer || "https://discord.gg/yourinvite")
    );

    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  const perms = member.permissions;
  const isAdmin =
    perms?.has(PermissionsBitField.Flags.Administrator) ||
    perms?.has(PermissionsBitField.Flags.ManageGuild);

  if (!isOwner && !isAdmin) {
    return interaction.reply({
      content: "⛔ You need **Administrator** (or Manage Server), or be a configured owner, to run this command.",
      ephemeral: true,
    });
  }

  const panelChannel = interaction.options.getChannel("panel_channel");
  const postChannel = interaction.options.getChannel("post_channel");

  await interaction.deferReply({ ephemeral: true });

  try {
    dbSetSettings.run(guild.id, panelChannel.id, postChannel.id);
    refreshLinkedGuilds();
  } catch (err) {
    console.error("[/setup] Failed to save setup:", err);
    return interaction.editReply({
      content: "⚠️ Failed to save setup in database. Check console logs for errors.",
    });
  }

  try {
    await panelChannel.send({
      embeds: [panelEmbed({ postChannelId: postChannel.id })],
      components: [tryLuckRow()],
    });
  } catch (err) {
    console.error("[/setup] Could not send panel message:", err);
    return interaction.editReply({
      content:
        "✅ Setup saved, but I couldn’t send the panel message. Please check my permissions (Send Messages, Embed Links) in that channel.",
    });
  }

  return interaction.editReply({
    content: `✅ Setup complete!\n• Panel: <#${panelChannel.id}>\n• Post: <#${postChannel.id}>`,
  });
}

export default { data, execute };
