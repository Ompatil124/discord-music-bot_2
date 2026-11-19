const test = require("node:test");
const assert = require("node:assert/strict");
const { resilientLookup, resolveHost, dnsCache, HARDCODED_FALLBACKS } = require("../src/utils/dnsResolver");

test("dnsResolver resolves discord.com with fallbacks", async () => {
  const entries = await resolveHost("discord.com");
  assert.ok(Array.isArray(entries), "should return an array of entries");
  assert.ok(entries.length > 0, "should return at least one IP address");
  assert.strictEqual(entries[0].family, 4, "should resolve IPv4 address");
});

test("dnsResolver caches results to avoid repeated lookups", async () => {
  dnsCache.clear();
  const first = await resolveHost("discord.com");
  assert.ok(dnsCache.has("discord.com"), "discord.com should be stored in cache");
  const cached = dnsCache.get("discord.com");
  assert.deepStrictEqual(cached.entries, first);
});

test("resilientLookup provides callback with all: true and all: false", async () => {
  await new Promise((resolve, reject) => {
    resilientLookup("discord.com", { all: true }, (err, addresses) => {
      if (err) return reject(err);
      assert.ok(Array.isArray(addresses));
      assert.ok(addresses.length > 0);
      resolve();
    });
  });

  await new Promise((resolve, reject) => {
    resilientLookup("discord.com", {}, (err, address, family) => {
      if (err) return reject(err);
      assert.ok(typeof address === "string");
      assert.strictEqual(family, 4);
      resolve();
    });
  });
});
