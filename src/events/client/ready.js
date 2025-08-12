// src/events/client/ready.js
import { Events, ActivityType } from "discord.js";
import { startExpirySweep } from "../../services/premiumManager.js";
import { dbDueUnpins, dbRemovePin } from "../../db/sqlite.js";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`[✅] Logged in as ${client.user.tag}`);

    // Function to update presence with accurate server/user count
    const updatePresence = () => {
      const totalMembers = client.guilds.cache.reduce(
        (acc, guild) => acc + (guild.memberCount || 0),
        0
      );

      client.user.setPresence({
        activities: [{
          name: `❤️ ${client.guilds.cache.size} servers & ${totalMembers} users`,
          type: ActivityType.Watching,
        }],
        status: "online",
      });
    };

    // Initial presence update
    updatePresence();

    // Auto-update presence every 5 minutes
    setInterval(updatePresence, 5 * 60 * 1000);

    // Start premium expiry checker
    startExpirySweep(client);

    // Unpin expired messages every 60s
    setInterval(async () => {
      const due = dbDueUnpins.all(Date.now());

      for (const row of due) {
        for (const guild of client.guilds.cache.values()) {
          for (const ch of guild.channels.cache.values()) {
            if (!ch?.isTextBased?.()) continue;
            try {
              const msg = await ch.messages.fetch(row.message_id);
              if (msg?.pinnable) await msg.unpin();
              break;
            } catch {}
          }
        }
        dbRemovePin.run(row.message_id);
      }
    }, 60 * 1000);
  }
};
