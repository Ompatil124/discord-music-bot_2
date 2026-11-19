const { existsSync } = require("node:fs");
const { resolve } = require("node:path");

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

const list = (value = "") => value.split(",").map((item) => item.trim()).filter(Boolean);
const boolean = (value, fallback = false) => {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

const primaryNode = {
  name: process.env.LAVALINK_NAME || "Primary",
  url: process.env.LAVALINK_URL || "localhost:2333",
  auth: process.env.LAVALINK_PASSWORD || "youshallnotpass",
  secure: boolean(process.env.LAVALINK_SECURE),
};

const defaultFallbackNodes = [
  { name: "Nazha", url: "lavalink.nazha.online:443", auth: "nazhafreelava", secure: true },
  { name: "Serenetia-SSL", url: "lavalink.serenetia.com:443", auth: "youshallnotpass", secure: true },
  { name: "Vinster", url: "freelavalinkvinster.in:443", auth: "youshallnotpass", secure: true },
  { name: "AjieBlogs", url: "lavalink.ajieblogs.eu.org:443", auth: "https://discord.gg/ajieblogs", secure: true },
  { name: "LavaV4-Ajie", url: "lava-v4.ajieblogs.eu.org:443", auth: "https://discord.gg/ajieblogs", secure: true },
];

function fallbackNodes() {
  const raw = process.env.LAVALINK_FALLBACKS;
  if (raw !== undefined && ["off", "false", "0", "no"].includes(raw.trim().toLowerCase())) return [];
  if (raw && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((node) => node && node.name && node.url && node.auth);
      }
    } catch {
      console.warn("[Config] LAVALINK_FALLBACKS is not valid JSON; using built-in fallbacks.");
    }
  }
  return defaultFallbackNodes;
}

const nodes = [primaryNode, ...fallbackNodes().filter((node) => node.url !== primaryNode.url)];

const config = {
  token: process.env.BOT_TOKEN || "",
  prefix: process.env.BOT_PREFIX || ".",
  ownerID: list(process.env.OWNER_IDS),
  SpotifyID: process.env.SPOTIFY_CLIENT_ID || "",
  SpotifySecret: process.env.SPOTIFY_CLIENT_SECRET || "",
  youtubeAPIKey: process.env.YOUTUBE_API_KEY || "",
  mongourl: process.env.MONGODB_URL || "",
  color: process.env.BOT_COLOR || "#3F4652",
  logs: process.env.LOG_LEVEL || "info",
  node_source: process.env.LAVALINK_SOURCE || "scsearch",

  links: {
    BG: process.env.BACKGROUND_URL || "",
    support: process.env.SUPPORT_URL || "",
    invite: process.env.INVITE_URL || "",
    Shafed_Billa: "♫ DC MUSIC",
    power: "developed by ompatil",
    vanity: process.env.VANITY_URL || "",
    guild: process.env.COMMUNITY_GUILD_ID || "",
  },

  Webhooks: {
    black: process.env.BLACKLIST_WEBHOOK_URL || "",
    player_create: process.env.PLAYER_CREATE_WEBHOOK_URL || "",
    player_delete: process.env.PLAYER_DELETE_WEBHOOK_URL || "",
    guild_join: process.env.GUILD_JOIN_WEBHOOK_URL || "",
    guild_leave: process.env.GUILD_LEAVE_WEBHOOK_URL || "",
    cmdrun: process.env.COMMAND_WEBHOOK_URL || "",
    system: process.env.COMMAND_WEBHOOK_URL || "",
    logs: process.env.LOGS_WEBHOOK_URL || process.env.COMMAND_WEBHOOK_URL || "",
    error: process.env.ERROR_WEBHOOK_URL || process.env.LOGS_WEBHOOK_URL || process.env.COMMAND_WEBHOOK_URL || "",
  },

  nodes,

  node_options: {
    moveOnDisconnect: true,
    resume: true,
    resumeTimeout: 60,
    resumeByLibrary: true,
    reconnectTries: 3,
    reconnectInterval: 2,
    restTimeout: 60_000,
    voiceConnectionTimeout: 30_000,
    userAgent: "DC MUSIC",
    nodeResolver: (nodes) => {
      const connected = [...nodes.values()].filter((n) => n.state === 1);
      if (!connected.length) return null;
      // Prefer primary configured node (e.g. Nazha) if connected
      const preferred = connected.find((n) => n.name === (process.env.LAVALINK_NAME || "Nazha"));
      if (preferred) return preferred;
      return connected.sort((a, b) => a.penalties - b.penalties)[0];
    },
  },
};

config.validate = () => {
  const missing = [];
  if (!config.token) missing.push("BOT_TOKEN");
  if (!config.mongourl) missing.push("MONGODB_URL");
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}. Copy .env.example to .env and fill in the values.`);
  }
};

module.exports = config;
