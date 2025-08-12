// src/features/profileFlow.js
import { isBanned } from "../services/banManager.js";
import { isPrime, isPlatinum } from "../services/premiumManager.js";
import { canPost, recordPost } from "../services/postLimiter.js";
import { profileEmbed } from "../components/embeds.js";
import { smashRejectRow } from "../components/buttons/smashReject.js";
import { dbCreatePost, dbAddPin, dbLinkPost } from "../db/sqlite.js";
import { CONFIG } from "../config.js";
import { crossPostIfPlatinum } from "../services/crosspost.js";

export async function runProfileFlow({ client, guild, user, postChannel, hiddenRequested = false }) {
  if (isBanned(user.id)) return { ok:false, reason:"You are banned from using this bot." };

  const prime = isPrime(user.id);
  const platinum = isPlatinum(user.id);
  const limitCheck = canPost(user.id, prime || platinum);
  if (!limitCheck.ok) return { ok:false, reason: limitCheck.reason };

  // Collect info via modal already handled; here we just send.
  const dm = await user.createDM().catch(() => null);
  if (!dm) return { ok:false, reason:"I couldn't DM you. Enable DMs and try again." };

  await dm.send("📸 Please send **one image** here within **1 minute**.");
  const photoMsg = await dm.awaitMessages({ max:1, time:60_000, filter:m=>m.author.id===user.id && m.attachments.size>0 });
  const img = photoMsg.first()?.attachments.first();
  if (!img) return { ok:false, reason:"No photo received within 1 minute." };

  // You likely passed these from the modal. If not, adapt.
  // For this snippet assume you already have name/age/city/bio available
  // (since you asked only for the cross-post/count sync here).
  // If you call this from the modal handler, pass those values in opts.
  const { name, age, city, bio } = arguments[0].profile || {};

  const embed = profileEmbed({ userId: user.id, name, age, city, bio, imageUrl: img.url }).setFooter({ text:"Anonymous" });
  const components = [smashRejectRow({ smash:0, reject:0 })];

  const sent = await postChannel.send({ embeds:[embed], components });

  // Save the *root* post + link the root to itself
  try {
    dbCreatePost.run({
      message_id: sent.id,
      owner_id: user.id,
      name, age, city, bio,
      image_url: img.url,
      smash_count: 0,
      reject_count: 0
    });
    dbLinkPost.run(sent.id, sent.id); // 🔗 link root→root
  } catch {}

  recordPost(user.id);

  if (prime || platinum) {
    try {
      await sent.pin();
      const hours = CONFIG?.defaults?.primePinHours ?? 4;
      const unpinAt = Date.now() + hours * 3600 * 1000;
      dbAddPin.run(sent.id, unpinAt);
    } catch {}
  }

  // Cross‑post for Platinum (and store links for copies)
  try {
    await crossPostIfPlatinum(client, user.id, guild.id, sent.id, {
      embeds: [embed],
      components
    });
  } catch {}

  try { await dm.send(`✅ Your profile was posted in **${guild.name}**${platinum ? " and cross‑posted to linked servers" : ""}.`); } catch {}

  return { ok:true };
}

export default runProfileFlow;
