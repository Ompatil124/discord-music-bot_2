const dns = require("node:dns");

const dnsCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

// Cloudflare Anycast IPs for Discord
const HARDCODED_FALLBACKS = {
  "discord.com": [
    { address: "162.159.138.232", family: 4 },
    { address: "162.159.137.232", family: 4 },
    { address: "162.159.136.232", family: 4 },
    { address: "162.159.135.232", family: 4 },
  ],
  "gateway.discord.gg": [
    { address: "162.159.135.234", family: 4 },
    { address: "162.159.136.234", family: 4 },
  ],
};

function queryWithPublicResolver(hostname, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    let resolver;
    let timer;
    try {
      resolver = new dns.promises.Resolver();
      resolver.setServers(["1.1.1.1", "8.8.8.8", "1.0.0.1", "8.8.4.4"]);
    } catch (e) {
      return reject(e);
    }

    timer = setTimeout(() => {
      try {
        resolver.cancel();
      } catch {}
      reject(new Error("DNS query timeout"));
    }, timeoutMs);

    resolver
      .resolve4(hostname)
      .then((ips) => {
        clearTimeout(timer);
        resolve(ips);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function queryWithOsLookup(hostname, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("OS lookup timeout"));
    }, timeoutMs);

    dns.lookup(hostname, { all: true }, (err, addresses) => {
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(addresses);
    });
  });
}

async function resolveHost(hostname) {
  const normalizedHost = String(hostname || "").toLowerCase().trim();
  const now = Date.now();
  const cached = dnsCache.get(normalizedHost);
  if (cached && now < cached.expires) {
    return cached.entries;
  }

  // 1. Try standard OS dns.lookup
  try {
    const entries = await queryWithOsLookup(normalizedHost, 2000);
    if (Array.isArray(entries) && entries.length > 0) {
      dnsCache.set(normalizedHost, { entries, expires: now + CACHE_TTL_MS });
      return entries;
    }
  } catch {
    // OS DNS failed or timed out
  }

  // 2. Try fallback public DNS resolver (1.1.1.1 / 8.8.8.8)
  try {
    const ips = await queryWithPublicResolver(normalizedHost, 2000);
    if (Array.isArray(ips) && ips.length > 0) {
      const entries = ips.map((ip) => ({ address: ip, family: 4 }));
      dnsCache.set(normalizedHost, { entries, expires: now + CACHE_TTL_MS });
      return entries;
    }
  } catch {
    // Public DNS failed or timed out
  }

  // 3. Use stale cache entry if available
  if (cached && Array.isArray(cached.entries) && cached.entries.length > 0) {
    return cached.entries;
  }

  // 4. Fallback to hardcoded core Discord IPs if applicable
  const hardcoded = HARDCODED_FALLBACKS[normalizedHost];
  if (hardcoded) {
    dnsCache.set(normalizedHost, { entries: hardcoded, expires: now + CACHE_TTL_MS });
    return hardcoded;
  }

  const notFound = new Error(`getaddrinfo ENOTFOUND ${normalizedHost}`);
  notFound.code = "ENOTFOUND";
  notFound.syscall = "getaddrinfo";
  notFound.hostname = normalizedHost;
  throw notFound;
}

function resilientLookup(hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }

  resolveHost(hostname)
    .then((entries) => {
      if (options && options.all) {
        callback(null, entries);
      } else {
        const first = entries[0];
        callback(null, first.address, first.family);
      }
    })
    .catch((err) => {
      callback(err);
    });
}

module.exports = {
  resilientLookup,
  resolveHost,
  dnsCache,
  HARDCODED_FALLBACKS,
};
