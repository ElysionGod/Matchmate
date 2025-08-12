// src/handlers/interactionHandler.js
import { BUTTONS } from "../constants.js";
import { isBanned } from "../services/banManager.js";
import { isPrime, isPlatinum } from "../services/premiumManager.js";
import { canPost, recordPost } from "../services/postLimiter.js";
import { profileEmbed } from "../components/embeds.js";
import { smashRejectRow } from "../components/buttons/smashReject.js";
import { buildAppFormModal } from "../components/modals.js";
import { dbGetSettings, dbCreatePost, dbAddPin, dbLinkPost } from "../db/sqlite.js";
import { crossPostIfPlatinum } from "../services/crosspost.js";
import { handleSmash, handleReject } from "../features/posting.js";
import { sendPostLog } from "../services/postLogger.js";
import { CONFIG } from "../config.js";

/** Acknowledge early to avoid timeout */
async function safeDefer(interaction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }
  } catch {}
}

async function safeRespond(interaction, content) {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  } catch {}
}

export async function handleInteraction(interaction) {
  const client = interaction.client;

  try {
    // Banned check
    if (!interaction.user?.bot && isBanned(interaction.user.id)) {
      return safeRespond(interaction, "🚫 You are banned from using this bot.");
    }

    // ===== SLASH COMMANDS =====
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return safeRespond(interaction, "❌ Unknown command.");

      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(`[❌] Error in /${interaction.commandName}:`, err);
        return safeRespond(interaction, "❌ Something went wrong while executing that command.");
      }
      return;
    }

    // ===== BUTTONS =====
    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id === "startPost") {
        const modal = buildAppFormModal();
        return interaction.showModal(modal);
      }

      if (id === BUTTONS.SMASH) return handleSmash({ interaction });
      if (id === BUTTONS.REJECT) return handleReject({ interaction });

      return safeRespond(interaction, "Unknown button.");
    }

    // ===== MODAL SUBMIT =====
    if (interaction.isModalSubmit()) {
      if (interaction.customId !== "appForm") return;

      const name = interaction.fields.getTextInputValue("name")?.trim();
      const age  = interaction.fields.getTextInputValue("age")?.trim();
      const city = interaction.fields.getTextInputValue("city")?.trim();
      const bio  = interaction.fields.getTextInputValue("bio")?.trim();

      if (!name || !age || !city || !bio) {
        return safeRespond(interaction, "❌ Please fill all fields.");
      }

      const userId   = interaction.user.id;
      const prime    = isPrime(userId);
      const platinum = isPlatinum(userId);

      const limit = canPost(userId, prime || platinum);
      if (!limit.ok) {
        return safeRespond(interaction, `❌ ${limit.reason}`);
      }

      const settings = dbGetSettings.get(interaction.guildId);
      const postChannelId = settings?.post_channel_id;
      if (!postChannelId) {
        return safeRespond(interaction, "⚠️ Server isn’t configured. Ask an admin to run `/setup` or `!setup`.");
      }

      const postChannel = await interaction.guild.channels.fetch(postChannelId).catch(() => null);
      if (!postChannel || !postChannel.isTextBased()) {
        return safeRespond(interaction, "⚠️ I can’t access the post channel. Check my permissions or re‑run setup.");
      }

      // Defer before heavy work
      await safeDefer(interaction);
      await safeRespond(interaction, "📨 Check your DMs — send your photo within 1 minute.");

      // DM the user for image
      let dm;
      try { dm = await interaction.user.createDM(); } catch { dm = null; }
      if (!dm) return;

      await dm.send("📸 Please send **one image** here within **1 minute**.");
      const photoMsg = await dm.awaitMessages({
        max: 1,
        time: 60_000,
        filter: (m) => m.author.id === userId && m.attachments.size > 0,
      });

      const imgAtt = photoMsg.first()?.attachments.first();
      if (!imgAtt) {
        try { await dm.send("⏰ Time’s up — no photo received."); } catch {}
        return;
      }

      const embed = profileEmbed({
        userId,
        name,
        age,
        city,
        bio,
        imageUrl: imgAtt.url,
      }).setFooter({ text: "Anonymous" });

      const components = [smashRejectRow({ smash: 0, reject: 0 })];
      const sent = await postChannel.send({ embeds: [embed], components });

      // Save & link root post
      try {
        dbCreatePost.run({
          message_id: sent.id,
          owner_id: userId,
          name,
          age,
          city,
          bio,
          image_url: imgAtt.url,
          smash_count: 0,
          reject_count: 0,
        });
        dbLinkPost.run(sent.id, sent.id);
      } catch {}

      // Log
      const tier = platinum ? "platinum" : (prime ? "prime" : "free");
      try {
        await sendPostLog({
          message: sent,
          user: interaction.user,
          profile: { name, age, city, bio, imageUrl: imgAtt.url },
          tier,
          hiddenMode: false,
          isCrosspost: false,
        });
      } catch {}

      // Consume quota
      recordPost(userId);

      // Pin if premium
      if (prime || platinum) {
        try {
          await sent.pin();
          const hours = CONFIG?.defaults?.primePinHours ?? 4;
          const unpinAt = Date.now() + hours * 3600 * 1000;
          dbAddPin.run(sent.id, unpinAt);
        } catch {}
      }

      // Crosspost
      try {
        await crossPostIfPlatinum(
          client,
          userId,
          interaction.guildId,
          sent.id,
          { embeds: [embed], components },
          {
            user: interaction.user,
            profile: { name, age, city, bio, imageUrl: imgAtt.url },
            tier,
            hiddenMode: false,
          }
        );
      } catch {}

      try {
        await dm.send(`✅ Your profile was posted in **${interaction.guild.name}**${platinum ? " and cross‑posted to linked servers" : ""}.`);
      } catch {}
    }
  } catch (err) {
    console.error("[BOT] Interaction error:", err);
    try { await safeRespond(interaction, "⚠️ Something went wrong handling that interaction."); } catch {}
  }
}

export default handleInteraction;
