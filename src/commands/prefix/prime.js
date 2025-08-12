import { getPremium } from "../../services/premiumManager.js";

export default async ({ message }) => {
  const p = getPremium(message.author.id);
  if (!p) return message.reply("You are not a Prime/Platinum member.");
  const exp = p.expires_at ? `<t:${Math.floor(p.expires_at/1000)}:R>` : "never";
  return message.reply(`Tier: **${p.tier}**, expires: ${exp}`);
};
