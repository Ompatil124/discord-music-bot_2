const test = require("node:test");
const assert = require("node:assert/strict");
const { Collection } = require("discord.js");
const playerStuck = require("../src/events/Players/playerStuck");
const AutoDestroy = require("../src/events/Client/AutoDestroy");

test("playerStuck calls player.skip() to auto-recover from hung audio streams", async () => {
  let skipped = false;
  const mockPlayer = {
    guildId: "123456789",
    playing: true,
    queue: {
      current: { title: "Stuck Song" },
    },
    skip: async () => {
      skipped = true;
    },
  };

  const mockClient = {
    logger: {
      log: () => {},
    },
  };

  await playerStuck.run(mockClient, mockPlayer, { thresholdMs: 10000 });
  assert.strictEqual(skipped, true, "player.skip() should have been invoked on stuck track");
});

test("voiceStateUpdate automatically resumes paused player when human joins voice channel", async () => {
  let resumed = false;

  const mockPlayer = {
    guildId: "123456789",
    voiceId: "vc-1",
    textId: "txt-1",
    paused: true,
    data: new Map([["pausedByAlone", true]]),
    queue: {
      current: { title: "Paused Song", uri: "https://example.com" },
    },
    pause: (state) => {
      if (state === false) resumed = true;
    },
  };

  const membersCol = new Collection();
  membersCol.set("bot-id", { user: { bot: true } });
  membersCol.set("user-id", { user: { bot: false } }); // 1 human listener

  const mockChannel = {
    id: "vc-1",
    isVoiceBased: () => true,
    members: membersCol,
  };

  const channelsCol = new Collection();
  channelsCol.set("vc-1", mockChannel);

  const guildMembersCol = new Collection();
  guildMembersCol.set("bot-id", { voice: { channel: mockChannel } });
  guildMembersCol.set("user-id", { voice: { channel: mockChannel } });

  const mockGuild = {
    id: "123456789",
    channels: {
      cache: channelsCol,
    },
    members: {
      cache: guildMembersCol,
    },
  };

  const guildsCol = new Collection();
  guildsCol.set("123456789", mockGuild);

  const mockClient = {
    user: { id: "bot-id" },
    guilds: {
      cache: guildsCol,
    },
    channels: {
      cache: new Collection(),
    },
    manager: {
      players: new Map([["123456789", mockPlayer]]),
    },
    logger: {
      log: () => {},
    },
    emoji: {
      check: "✅",
    },
  };

  const oldState = { guild: mockGuild, channelId: null };
  const newState = { guild: mockGuild, channelId: "vc-1" };

  await AutoDestroy.run(mockClient, oldState, newState);
  assert.strictEqual(resumed, true, "player.pause(false) should be called to auto-resume playback");
  assert.strictEqual(mockPlayer.data.get("pausedByAlone"), undefined, "pausedByAlone flag should be cleared");
});

test("voiceStateUpdate exits cleanly without throwing when no player exists", async () => {
  const mockGuild = {
    id: "99999",
    channels: { cache: new Collection() },
    members: { cache: new Collection() },
  };
  const mockClient = {
    user: { id: "bot-id" },
    guilds: { cache: new Collection([["99999", mockGuild]]) },
    manager: { players: new Map() }, // No player for 99999
    logger: { log: () => {} },
  };

  const oldState = { guild: mockGuild, channelId: "vc-random" };
  const newState = { guild: mockGuild, channelId: null };

  // Must not throw TypeError: Cannot read properties of undefined (reading 'voiceId')
  await AutoDestroy.run(mockClient, oldState, newState);
});
