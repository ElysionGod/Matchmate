// src/features/posting.js
import {
  dbUpdateCounts,
  dbGetPost,
  dbRecordSmash,
  dbHasSmashed,
  dbGetRootFromMessage,
  dbGetAllLinked,
} from "../db/sqlite.js";

import { isPrime } from "../services/premiumManager.js";
import { smashRejectRow } from "../components/buttons/smashReject.js";
import { buildRevealEmbed, buildDMRow } from "../components/ui.js";

/** parse profile fields from the embed used in posts */
function parseProfileFromEmbed(embed) {
  const desc = embed?.description || "";
  const pick = (label) => {
    const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*\\\`([^\\\`]*)\\\``);
    const m = desc.match(re);
    return m?.[1] ?? "";
  };
  const name = pick("Name");
  const ageRaw = pick("Age");
  const age = ageRaw ? ageRaw.replace(/[^0-9]/g, "") : "";
  const city = pick("City");
  const bio = pick("About");
  const imageUrl = embed?.image?.url ?? null;
  return { name, age, city, bio, imageUrl };
}

/** robust: get the root post id from any message id (copy or root) */
function getRootId(messageId) {
  const link = dbGetRootFromMessage.get(messageId);
  if (link?.root_id) return link.root_id;
  const row = dbGetPost.get(messageId);
  return row ? messageId : null;
}

/** update the Smash/Reject buttons on every linked message */
async function syncButtonsOnAllCopies(client, rootId, counts) {
  const linked = dbGetAllLinked.all(rootId); // includes root itself
  for (const r of linked) {
    const id = r.message_id;
    for (const [, guild] of client.guilds.cache) {
      const channels = guild.channels.cache.filter((c) => c.isTextBased?.());
      for (const [, ch] of channels) {
        try {
          const msg = await ch.messages.fetch(id).catch(() => null);
          if (!msg) continue;
          await msg.edit({
            components: [
              smashRejectRow({
                smash: counts.smash_count,
                reject: counts.reject_count,
              }),
            ],
          });
          break;
        } catch {}
      }
    }
  }
}

/** utilities to avoid "Unknown interaction" */
async function safeDefer(interaction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 64 });
    }
  } catch {}
}
async function safeRespond(interaction, content) {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content });
    } else {
      await interaction.reply({ flags: 64, content });
    }
  } catch {}
}

export async function handleSmash({ interaction }) {
  // ACK NOW to avoid Unknown interaction
  await safeDefer(interaction);

  const msg = interaction.message;
  const rootId = getRootId(msg.id);
  if (!rootId) return safeRespond(interaction, "Post not found.");

  const post = dbGetPost.get(rootId);
  if (!post) return safeRespond(interaction, "Post not found.");

  const posterId = post.owner_id;
  const smasherId = interaction.user.id;

  // 🚫 no self-votes
  if (posterId === smasherId) {
    return safeRespond(interaction, "You cannot vote on your own post.");
  }

  // one smash per (poster, smasher) pair globally
  if (dbHasSmashed.get(posterId, smasherId)) {
    return safeRespond(interaction, "You've already voted on this user.");
  }

  // record + update counts on root
  try {
    dbRecordSmash.run(posterId, smasherId, rootId);
    dbUpdateCounts.run(1, 0, rootId);
  } catch {
    // even if DB write fails, avoid throwing the interaction
  }

  const updated = dbGetPost.get(rootId);

  // sync buttons everywhere (this can be slow, but we've already deferred)
  try {
    await syncButtonsOnAllCopies(interaction.client, rootId, updated);
  } catch {}

  // DM the smasher profile info + DM button
  try {
    const embed = msg.embeds?.[0]?.data ? msg.embeds[0] : null;
    if (embed) {
      const profile = parseProfileFromEmbed(embed);
      const posterUser = await interaction.client.users.fetch(posterId).catch(() => null);
      const dm = await interaction.user.createDM();
      await dm.send({
        embeds: [buildRevealEmbed(profile, posterUser, profile.imageUrl || embed.image?.url)],
        components: [buildDMRow(posterId)],
      });
    }
  } catch {}

  // Prime posters can see who smashed them instantly
  try {
    if (isPrime(posterId)) {
      const posterUser = await interaction.client.users.fetch(posterId);
      await posterUser.send(`**✨ Prime perk**: Someone smashed your post: \n **• User:**<@${smasherId}>`);
    }
  } catch {}

  return safeRespond(interaction, "Smash recorded! Check your DMs.");
}

export async function handleReject({ interaction }) {
  // ACK NOW to avoid Unknown interaction
  await safeDefer(interaction);

  const msg = interaction.message;
  const rootId = getRootId(msg.id);
  if (!rootId) return safeRespond(interaction, "Post not found.");

  const post = dbGetPost.get(rootId);
  if (!post) return safeRespond(interaction, "Post not found.");

  const voterId = interaction.user.id;

  // 🚫 no self-votes
  if (post.owner_id === voterId) {
    return safeRespond(interaction, "You cannot vote on your own post.");
  }

  // bump reject count on root
  try {
    dbUpdateCounts.run(0, 1, rootId);
  } catch {}

  const updated = dbGetPost.get(rootId);

  // sync buttons everywhere
  try {
    await syncButtonsOnAllCopies(interaction.client, rootId, updated);
  } catch {}

  return safeRespond(interaction, "Reject recorded.");
}
