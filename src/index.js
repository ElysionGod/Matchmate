// src/index.js
import "dotenv/config";
import { Client, GatewayIntentBits, Partials, REST, Routes, Collection, Events } from "discord.js";
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { startExpirySweep } from "./services/premiumManager.js";
import { dbDueUnpins, dbRemovePin } from "./db/sqlite.js";
import handleInteraction from "./handlers/interactionHandler.js";
import { handlePrefixMessage } from "./handlers/commandHandler.js";

// Helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();

// Load client events
const clientEventsPath = join(__dirname, "events", "client");
const eventFiles = readdirSync(clientEventsPath).filter(file => file.endsWith(".js"));

for (const file of eventFiles) {
  const { default: event } = await import(`./events/client/${file}`);
  if (event?.name && typeof event.execute === "function") {
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }
}

// ✅ Slash command interaction handler
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      await interaction.reply({ content: "❌ Command not found.", ephemeral: true });
      return;
    }

    await command.execute(interaction, client);
  } catch (err) {
    console.error("[SLASH CMD ERROR]", err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: "❌ There was an error while executing this command." });
    } else {
      await interaction.reply({ content: "❌ There was an error while executing this command.", ephemeral: true });
    }
  }
});

// ✅ Button/Modal interaction handler (if needed)
client.on(Events.InteractionCreate, interaction => {
  if (!interaction.isChatInputCommand()) {
    handleInteraction(interaction);
  }
});

// ✅ Prefix command handler
client.on("messageCreate", message => handlePrefixMessage(client, message));



// ✅ Slash command registration
(async () => {
  try {
    const commands = [];
    const slashFiles = [
      (await import("./commands/slash/setup.js")),
      
      
    ];

    for (const cmd of slashFiles) {
      if (cmd?.data && typeof cmd.execute === "function") {
        commands.push(cmd.data.toJSON());
        client.commands.set(cmd.data.name, cmd);
      }
    }

    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });

    console.log(`[✓] Registered ${commands.length} global slash commands.`);
  } catch (e) {
    console.error("[ERROR REGISTERING SLASH COMMANDS]", e);
  }
})();

// ✅ Login
client.login(process.env.DISCORD_TOKEN);
