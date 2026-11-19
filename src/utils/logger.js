const moment = require("moment-timezone");

function isHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function truncate(str, max = 3900) {
  const s = String(str || "");
  if (s.length <= max) return s;
  return s.slice(0, max - 30) + "\n...[truncated]";
}

const errorQueue = [];
let errorTimer = null;

const activityQueue = [];
let activityTimer = null;

function getWebhookUrl(category = "activity") {
  if (category === "error") {
    return (
      process.env.ERROR_WEBHOOK_URL ||
      process.env.LOGS_WEBHOOK_URL ||
      process.env.COMMAND_WEBHOOK_URL ||
      ""
    ).trim();
  }
  return (
    process.env.LOGS_WEBHOOK_URL ||
    process.env.COMMAND_WEBHOOK_URL ||
    ""
  ).trim();
}

async function postToWebhook(url, payload) {
  if (!isHttpUrl(url)) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Fail silently to prevent recursive logging loops
  }
}

async function flushErrors() {
  if (errorTimer) {
    clearTimeout(errorTimer);
    errorTimer = null;
  }
  if (!errorQueue.length) return;

  const batch = errorQueue.splice(0, 10);
  const url = getWebhookUrl("error");
  if (!url) return;

  const content = batch.map((item) => item.line).join("\n");
  const hasError = batch.some((item) => item.type === "ERROR");

  const embed = {
    title: hasError ? "🚨 Bot Error Alert" : "⚠️ Bot Warning Alert",
    description: `\`\`\`prolog\n${truncate(content)}\n\`\`\``,
    color: hasError ? 0xed4245 : 0xfee75c,
    timestamp: new Date().toISOString(),
    footer: { text: "DC Music • Error Monitor" },
  };

  await postToWebhook(url, { embeds: [embed] });
}

async function flushActivity() {
  if (activityTimer) {
    clearTimeout(activityTimer);
    activityTimer = null;
  }
  if (!activityQueue.length) return;

  const batch = activityQueue.splice(0, 20);
  const url = getWebhookUrl("activity");
  if (!url) return;

  const content = batch.join("\n");
  const embed = {
    title: "📋 Bot Activity Logs",
    description: `\`\`\`prolog\n${truncate(content)}\n\`\`\``,
    color: 0x5865f2,
    timestamp: new Date().toISOString(),
    footer: { text: "DC Music • Activity Monitor" },
  };

  await postToWebhook(url, { embeds: [embed] });
}

process.on("beforeExit", () => {
  flushErrors().catch(() => {});
  flushActivity().catch(() => {});
});

/**
 * om_music_bot - Anime Logger
 * Clean, Sexy, and Kawaii ~ with Discord Webhook Streaming
 */
class Logger {
  static get now() {
    return moment().tz("Asia/Kolkata").format("DD-MM-YYYY HH:mm:ss");
  }

  static get style() {
    return {
      reset: "\x1b[0m",
      bold: "\x1b[1m",
      dim: "\x1b[2m",
      italic: "\x1b[3m",

      // Foreground Colors
      black: "\x1b[30m",
      red: "\x1b[31m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      blue: "\x1b[34m",
      magenta: "\x1b[35m",
      cyan: "\x1b[36m",
      white: "\x1b[37m",
      gray: "\x1b[90m",

      // Background Colors
      bgRed: "\x1b[41m",
      bgGreen: "\x1b[42m",
      bgYellow: "\x1b[43m",
      bgBlue: "\x1b[44m",
      bgMagenta: "\x1b[45m",
      bgCyan: "\x1b[46m",
      bgWhite: "\x1b[47m",
    };
  }

  static _print(type, icon, color, message) {
    const s = this.style;
    const timestamp = `${s.gray}[${this.now}]${s.reset}`;
    const badge = `${color}${s.bold}${icon} ${type.padEnd(5)}${s.reset}`;
    const formattedMessage =
      typeof message === "string"
        ? message
        : message?.stack || message?.message || JSON.stringify(message);
    const content = `${s.white}${formattedMessage}${s.reset}`;

    console.log(`${timestamp} ${badge} ${s.gray}::${s.reset} ${content}`);

    this._dispatchWebhook(type, formattedMessage);
  }

  static _dispatchWebhook(type, message) {
    const plainLine = `[${this.now}] ${type.padEnd(5)} :: ${message}`;

    if (type === "ERROR" || type === "WARN") {
      errorQueue.push({ type, line: plainLine });
      if (!errorTimer) {
        errorTimer = setTimeout(() => {
          flushErrors().catch(() => {});
        }, 800);
        errorTimer.unref?.();
      }
      if (errorQueue.length >= 3) {
        flushErrors().catch(() => {});
      }
    } else {
      activityQueue.push(plainLine);
      if (!activityTimer) {
        activityTimer = setTimeout(() => {
          flushActivity().catch(() => {});
        }, 6000); // Batches every 6 seconds
        activityTimer.unref?.();
      }
      if (activityQueue.length >= 10) {
        flushActivity().catch(() => {});
      }
    }
  }

  static async flush() {
    await Promise.allSettled([flushErrors(), flushActivity()]);
  }

  static async sendWebhook(payload, category = "activity") {
    const url = getWebhookUrl(category);
    if (!url) return false;
    await postToWebhook(url, payload);
    return true;
  }

  static log(message, type = "info") {
    switch (type.toLowerCase()) {
      case "info":
      case "log":
        this.info(message);
        break;
      case "warn":
      case "warning":
        this.warn(message);
        break;
      case "error":
      case "err":
        this.error(message);
        break;
      case "debug":
        this.debug(message);
        break;
      case "cmd":
        this.cmd(message);
        break;
      case "event":
        this.event(message);
        break;
      case "ready":
        this.ready(message);
        break;
      case "system":
        this.system(message);
        break;
      default:
        this.info(message);
        break;
    }
  }

  static info(message) {
    this._print("INFO", "( ◕ ‿ ◕ )", this.style.cyan, message);
  }

  static warn(message) {
    this._print("WARN", "( ◕ ︿ ◕ )", this.style.yellow, message);
  }

  static error(message) {
    this._print("ERROR", "( ✖ ╭╮ ✖ )", this.style.red, message);
  }

  static debug(message) {
    this._print("DEBUG", "( ¬ ‿ ¬ )", this.style.gray, message);
  }

  static cmd(message) {
    this._print("CMD", "( ⋆ ＾ － ＾ ⋆ )", this.style.cyan, message);
  }

  static event(message) {
    this._print("EVENT", "( ﾉ ◕ ヮ ◕ )ﾉ", this.style.blue, message);
  }

  static ready(message) {
    this._print("READY", "( ✿ ◠ ‿ ◠ )", this.style.green, message);
  }

  static system(message) {
    this._print("SYSTEM", "( ー _ ー )", this.style.white, message);
  }
}

module.exports = Logger;
