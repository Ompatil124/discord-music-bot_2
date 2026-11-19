const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { migratePlayer, failoverNodePlayers } = require("../src/utils/nodeFailover");

const root = path.join(__dirname, "..");

function loadNodes(extraEnv) {
  const code = "const config = require('./src/config'); process.stdout.write(JSON.stringify(config.nodes));";
  const output = execFileSync(process.execPath, ["-e", code], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
  });
  return JSON.parse(output);
}

test("configuration exposes multiple unique Lavalink nodes for failover", () => {
  const nodes = loadNodes({ LAVALINK_FALLBACKS: "" });
  assert.ok(nodes.length >= 2);
  assert.equal(new Set(nodes.map((node) => node.url)).size, nodes.length);
  assert.ok(nodes.every((node) => node.name && node.url && node.auth && typeof node.secure === "boolean"));
});

test("fallback nodes can be disabled", () => {
  const nodes = loadNodes({ LAVALINK_FALLBACKS: "off" });
  assert.equal(nodes.length, 1);
});

test("custom fallback JSON is honoured", () => {
  const custom = [{ name: "Custom", url: "custom.example:2333", auth: "pw", secure: false }];
  const nodes = loadNodes({ LAVALINK_FALLBACKS: JSON.stringify(custom) });
  assert.deepEqual(nodes[1], custom[0]);
});

test("primary node is never duplicated by fallbacks", () => {
  const primary = loadNodes({ LAVALINK_FALLBACKS: "off" })[0];
  const nodes = loadNodes({ LAVALINK_FALLBACKS: JSON.stringify([primary]) });
  assert.equal(nodes.filter((node) => node.url === primary.url).length, 1);
});

test("migratePlayer successfully migrates player to healthy connected backup node", async () => {
  let movedTarget = null;
  const mockPlayer = {
    guildId: "12345",
    node: { name: "DeadNode" },
    shoukaku: {
      move: async (target) => {
        movedTarget = target;
        return true;
      },
    },
  };

  const mockClient = {
    manager: {
      shoukaku: {
        nodes: new Map([
          ["DeadNode", { name: "DeadNode", state: 3, penalties: 100 }],
          ["BackupNode", { name: "BackupNode", state: 1, penalties: 10 }],
        ]),
      },
    },
    logger: { log: () => {} },
  };

  const success = await migratePlayer(mockClient, mockPlayer, "DeadNode");
  assert.strictEqual(success, true);
  assert.strictEqual(movedTarget, "BackupNode");
});

test("failoverNodePlayers triggers migration for all players on the failed node", async () => {
  const movedList = [];
  const p1 = {
    guildId: "g1",
    node: { name: "FailingNode" },
    shoukaku: { move: async (t) => { movedList.push({ id: "g1", t }); return true; } },
  };
  const p2 = {
    guildId: "g2",
    node: { name: "OtherNode" },
    shoukaku: { move: async (t) => { movedList.push({ id: "g2", t }); return true; } },
  };

  const mockClient = {
    manager: {
      players: new Map([["g1", p1], ["g2", p2]]),
      shoukaku: {
        nodes: new Map([
          ["FailingNode", { name: "FailingNode", state: 3, penalties: 100 }],
          ["HealthyNode", { name: "HealthyNode", state: 1, penalties: 5 }],
        ]),
      },
    },
    logger: { log: () => {} },
  };

  await failoverNodePlayers(mockClient, "FailingNode");
  assert.strictEqual(movedList.length, 1);
  assert.strictEqual(movedList[0].id, "g1");
  assert.strictEqual(movedList[0].t, "HealthyNode");
});
