// src/config.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dbAllGuildsWithPost } from "./db/sqlite.js"; // <-- uses prepared stmt from sqlite.js

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Try to load root config.json, falling back to config.example.json
const rootConfigPath = path.resolve(__dirname, "..", "config.json");
const examplePath    = path.resolve(__dirname, "..", "config.example.json");

let fileConfig = {};
try {
  if (fs.existsSync(rootConfigPath)) {
    fileConfig = JSON.parse(fs.readFileSync(rootConfigPath, "utf8"));
  } else if (fs.existsSync(examplePath)) {
    console.warn("[CONFIG] config.json not found — using config.example.json");
    fileConfig = JSON.parse(fs.readFileSync(examplePath, "utf8"));
  } else {
    console.warn("[CONFIG] No config.json or config.example.json found. Using defaults.");
    fileConfig = {};
  }
} catch (e) {
  console.error("[CONFIG] Failed to read config:", e);
  fileConfig = {};
}

// Defaults
const CONFIG = {
  prefix: "!",
  ownerIds: [],
  webhooks: { primeLog: "", platinumLog: "", removeplat: "", banLog: "" },
  defaults: { freeDailyPosts: 2, primePinHours: 4 },
  panelImageUrl: "",
  botName: "ALT F4",
  botId: "",
  linkedGuilds: [],
  ...fileConfig,
};

/**
 * Load all guild IDs that have a post channel configured into CONFIG.linkedGuilds
 * Call at startup, and anytime /setup saves new settings.
 */
export function refreshLinkedGuilds() {
  try {
    const rows = dbAllGuildsWithPost.all();
    CONFIG.linkedGuilds = rows.map(r => String(r.guild_id));
    console.log("[CONFIG] linkedGuilds auto-loaded:", CONFIG.linkedGuilds);
  } catch (err) {
    console.error("[CONFIG] Failed to auto-load linkedGuilds:", err);
  }
}

// Run once at module load
refreshLinkedGuilds();

export { CONFIG };
export default CONFIG;
