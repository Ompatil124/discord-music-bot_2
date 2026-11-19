const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildAutoplaySearches,
  isJunkTrack,
  isSameSong,
  rememberTracks,
  selectAutoplayCandidate,
  trackKeys,
} = require("../src/utils/autoplay");
const { attemptAutoplay } = require("../src/utils/playerUtils");

const source = {
  identifier: "source-upload",
  title: "Side To Side (Official Video)",
  author: "Ariana Grande - Topic",
  uri: "https://youtube.com/watch?v=abcdefghijk",
};

test("autoplay rejects the same song across uploads and durations", () => {
  assert.equal(isSameSong(source, {
    identifier: "different-upload",
    title: "Side To Side [Official Audio]",
    author: "Ariana Grande",
    uri: "https://youtube.com/watch?v=lmnopqrstuv",
    length: 999_999,
  }), true);
});

test("autoplay chooses a genuinely different and non-recent song", () => {
  const recent = { identifier: "recent", title: "Positions", author: "Ariana Grande" };
  const next = { identifier: "next", title: "Into You", author: "Ariana Grande" };
  const blocked = rememberTracks([], [source, recent]);
  const selected = selectAutoplayCandidate(source, [source, recent, next], blocked);
  assert.equal(selected, next);
  assert.ok(trackKeys(selected).some((key) => key === "id:next"));
});

test("autoplay starts with discovery queries instead of the exact song", () => {
  const searches = buildAutoplaySearches(source);
  assert.deepEqual(searches[0], ["ytmsearch", "ariana grande radio"]);
  assert.notEqual(searches[0][1], "side to side ariana grande");
});

test("autoplay queues a different recommendation and starts it", async () => {
  const next = { identifier: "next", title: "Into You", author: "Ariana Grande" };
  const queued = [];
  const searches = [];
  let started = false;
  const player = {
    guildId: "guild",
    playing: false,
    paused: false,
    loop: "none",
    data: new Map([["autoplay", true], ["lastTrack", source]]),
    queue: { size: 0, add: (track) => queued.push(track) },
    search: async (query) => {
      searches.push(query);
      return { tracks: [source, next] };
    },
    play: async () => { started = true; },
  };
  await attemptAutoplay({ user: { id: "bot" }, logger: { log() {} } }, player);
  assert.deepEqual(queued, [next]);
  assert.equal(started, true);
  assert.equal(searches[0], "ariana grande radio");
});

test("autoplay filters out live parts, episodes, and non-song content", () => {
  const livePart = { identifier: "p1", title: "Chandan Kamble Live (Part - 10)", author: "Chandan Kamble", length: 300_000 };
  const shortClip = { identifier: "p2", title: "Promo Teaser", author: "Artist", length: 30_000 };
  const marathon = { identifier: "p3", title: "Nonstop 2 Hour Mix", author: "DJ", length: 7_200_000 };
  const realSong = { identifier: "s1", title: "Majha Kanhoba", author: "Chandan Kamble", length: 240_000 };

  assert.equal(isJunkTrack(livePart), true);
  assert.equal(isJunkTrack(shortClip), true);
  assert.equal(isJunkTrack(marathon), true);
  assert.equal(isJunkTrack(realSong), false);

  const selected = selectAutoplayCandidate(source, [livePart, shortClip, realSong]);
  assert.equal(selected, realSong);
});

test("autoplay does not run when queue has pending tracks", async () => {
  const queued = [];
  let started = false;
  const player = {
    guildId: "guild",
    playing: false,
    paused: false,
    loop: "none",
    data: new Map([["autoplay", true], ["lastTrack", source]]),
    queue: { size: 1, add: (track) => queued.push(track) },
    search: async () => ({ tracks: [] }),
    play: async () => { started = true; },
  };
  await attemptAutoplay({ user: { id: "bot" }, logger: { log() {} } }, player);
  assert.equal(queued.length, 0);
  assert.equal(started, false);
});
