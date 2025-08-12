// src/components/buttons/smashReject.js
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { BUTTONS } from "../../constants.js";

// Buttons now show the live counts in their labels
export function smashRejectRow(counters = { smash: 0, reject: 0 }) {
  const smash = Number(counters.smash) || 0;
  const reject = Number(counters.reject) || 0;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BUTTONS.SMASH)
      .setEmoji("1404823481320870041")
      .setLabel(`Smash (${smash})`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(BUTTONS.REJECT)
      .setEmoji("1404823466309451897")
      .setLabel(`Reject (${reject})`)
      .setStyle(ButtonStyle.Danger)
  );
}

// Used when we DM users after a match
export function dmPosterRow(urlToDM) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("Direct Message").setStyle(ButtonStyle.Link).setURL(urlToDM)
  );
}
