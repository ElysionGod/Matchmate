// src/handlers/commandHandler.js
import { CONFIG } from "../config.js";
import { log } from "../utils/logger.js";

/**
 * Normalize a string that may be <@mentions>, #channels, etc. to a plain token.
 */
function cleanToken(s) {
  return (s || "").trim();
}

/**
 * Resolve the prefix and extract command + args.
 */
function parseCommand(messageContent, prefix) {
  if (!messageContent?.startsWith(prefix)) return null;
  const without = messageContent.slice(prefix.length).trim();
  if (!without) return null;
  const parts = without.split(/\s+/);
  const cmd = parts.shift()?.toLowerCase();
  return { cmd, args: parts };
}

/**
 * Try importing a prefix command module by name.
 * Expected path: ../commands/prefix/<name>.js
 */
async function importPrefixCommand(name) {
  try {
    // IMPORTANT: include .js extension for ESM dynamic import
    const mod = await import(`../commands/prefix/${name}.js`);
    return mod?.default || null;
  } catch {
    return null; // not found or failed to load
  }
}

/**
 * Run a loaded command module.
 * Supports two shapes:
 * 1) default function: ({ client, message, args }) => Promise<void>
 * 2) default object: { name, aliases?, ownerOnly?, run(client, message, args) }
 */
async function runLoadedCommand(cmdModule, client, message, args) {
  // Function style
  if (typeof cmdModule === "function") {
    return cmdModule({ client, message, args });
  }

  // Object style
  if (cmdModule && typeof cmdModule.run === "function") {
    // Owner check if declared
    if (cmdModule.ownerOnly) {
      const isOwner = Array.isArray(CONFIG.ownerIds)
        ? CONFIG.ownerIds.includes(message.author.id)
        : false;
      if (!isOwner) {
        return message.reply("Owner-only command.");
      }
    }
    return cmdModule.run(client, message, args);
  }

  // Unsupported shape
  return message.reply("Command is not properly exported. Expected a default function or an object with a .run method.");
}

/**
 * Main prefix handler
 */
export async function handlePrefixMessage(client, message) {
  try {
    // Ignore bots & DMs for prefix commands (optional: allow DMs if you want)
    if (!message?.guild || message.author?.bot) return;

    const prefix = CONFIG.prefix ?? "!";
    const parsed = parseCommand(message.content, prefix);
    if (!parsed) return;

    const { cmd, args } = parsed;
    if (!cmd) return;

    // Load the command by filename: src/commands/prefix/<cmd>.js
    let commandModule = await importPrefixCommand(cmd);

    // If not found, try to map some legacy names to new ones (optional)
    if (!commandModule) {
      const aliasMap = {
        // legacy -> new
        "owner-prime": "addprime",
        "owner-ban": "ban",
      };
      if (aliasMap[cmd]) {
        commandModule = await importPrefixCommand(aliasMap[cmd]);
      }
    }

    if (!commandModule) {
      // Not found — give a helpful hint
      return message.reply(
        `Unknown command \`${prefix}${cmd}\`.\nTry: \`${prefix}addprime\`, \`${prefix}addplatinum\`, \`${prefix}removeprime\`, \`${prefix}removeplatinum\`, \`${prefix}ban\`, \`${prefix}setup\`, \`${prefix}prime\`.`
      );
    }

    // Owner check if the module exports an ownerOnly flag at top-level (object style).
    // For function style we cannot detect; prefer object style for owner-only commands.
    if (commandModule?.ownerOnly) {
      const isOwner = Array.isArray(CONFIG.ownerIds)
        ? CONFIG.ownerIds.includes(message.author.id)
        : false;
      if (!isOwner) return message.reply("Owner-only command.");
    }

    // Execute with compatibility for both export shapes
    await runLoadedCommand(commandModule, client, message, args);
  } catch (e) {
    log("Command error:", e);
    try {
      await message.reply("There was an error while executing that command.");
    } catch {
      // swallow
    }
  }
}
