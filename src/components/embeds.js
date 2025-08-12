// src/components/embeds.js
import { EmbedBuilder } from "discord.js";
import { COLORS } from "../constants.js";
import { CONFIG } from "../config.js";
import { isPrime, isPlatinum } from "../services/premiumManager.js"; // ✅ Check roles

/**
 * Post embed (matches your screenshot style) with Premium/Platinum badges.
 */
export function profileEmbed({ userId, name, age, city, bio, imageUrl }) {
  let badge = "";
  let color = COLORS.PRIMARY;

  if (isPlatinum(userId)) {
    badge = "💎 Platinum Member 💎";
    color = "#E5E4E2"; // platinum silver
  } else if (isPrime(userId)) {
    badge = "✨ Prime Member ✨";
    color = COLORS.GOLD;
  }

  const desc =
`| 🪪 **Name:** \`${name}\`
| 🎂 **Age:** \`${age} Years old\`
| 🏙️ **City:** \`${city}\`
| 📖 **About:** \`${bio}\``;

  return new EmbedBuilder()
    .setTitle(`${badge ? badge + " • " : ""}\`${CONFIG.botName}\``)
    .setDescription(desc)
    .setColor(color)
    .setImage(imageUrl)
    .setTimestamp();
}

/**
 * Setup panel embed shown in the panel channel after /setup or !setup.
 * KEEP this export name exactly: panelEmbed
 */
export function panelEmbed({ botName, postChannelId, panelImageUrl = "" }) {
  const channelMention = postChannelId ? `${postChannelId}` : "";
  const desc =
`<a:5038redfire:1404828744908279930>**Create Your Profile & Get Noticed!**<a:5038redfire:1404828744908279930>

**<a:run:1404829958144004219>  How it works:**
│ <a:BlueArrow:1404829939882266644>• Click **<:cupid0:1404827796764627064> Try Your Luck**
│ <a:BlueArrow:1404829939882266644>• Fill in your profile (name, age, city, bio)
│ <a:BlueArrow:1404829939882266644>• Bot DMs you to send a **photo** → you have **1 minute** 📸
│ <a:BlueArrow:1404829939882266644>• Posted in <#${channelMention}> anonymously 👀

**<:vote:1404836352767299604> Voting System:**
<a:Match:1404823481320870041> **Smash** → Receive profile info in DM
<:Reject:1404823466309451897> **Reject** → No action taken

**<a:Warning:1404829917236957226> Rules:** 
<a:alert:1404830704570859551> **Only 1 vote per user**
<a:alert:1404830704570859551> **Be respectful. DMs must be open.**`;

  const e = new EmbedBuilder()
    .setAuthor({ name: `${CONFIG.botName}` })
    .setDescription(desc)
    .setColor(COLORS.PRIMARY);

  // ✅ Automatically add image from config.json if set
  if (CONFIG.panelImageUrl) {
    e.setImage(CONFIG.panelImageUrl);
  }

  return e;
}
