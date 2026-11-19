const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");
const {
  decodeHtmlEntities,
  getYouTubeApiLastError,
  isYouTubeApiUnavailable,
  resetYouTubeApiState,
  searchYouTubeApi,
} = require("../src/utils/youtubeApi");

const trackItem = {
  id: { videoId: "dQw4w9WgXcQ" },
  snippet: {
    title: "A &amp; B &#39;x&#39;",
    channelTitle: "Chan &lt;3",
    thumbnails: { high: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" } },
  },
};

test("empty key or query never calls the API", async (t) => {
  resetYouTubeApiState();
  const get = t.mock.method(axios, "get", async () => ({ data: { items: [] } }));

  assert.deepEqual(await searchYouTubeApi("query", "", 1), []);
  assert.deepEqual(await searchYouTubeApi("   ", "key", 1), []);

  assert.equal(get.mock.calls.length, 0);
});

test("maps API items and decodes HTML entities", async (t) => {
  resetYouTubeApiState();
  const get = t.mock.method(axios, "get", async () => ({ data: { items: [trackItem] } }));

  const tracks = await searchYouTubeApi("query", "key", 5);

  assert.deepEqual(tracks, [{
    title: "A & B 'x'",
    author: "Chan <3",
    id: "dQw4w9WgXcQ",
    uri: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  }]);
  assert.equal(get.mock.calls.length, 1);
  assert.equal(get.mock.calls[0].arguments[1].params.maxResults, 5);
});

test("403 disables the API for a cooldown and logs once", async (t) => {
  resetYouTubeApiState();
  const forbidden = Object.assign(new Error("Request failed with status code 403"), {
    response: {
      status: 403,
      data: {
        error: {
          message: "Permission denied on the service.",
          errors: [{ reason: "forbidden" }],
        },
      },
    },
  });
  const get = t.mock.method(axios, "get", async () => { throw forbidden; });
  const log = t.mock.method(console, "error", () => {});

  assert.deepEqual(await searchYouTubeApi("query", "key", 1), []);
  assert.equal(isYouTubeApiUnavailable(), true);
  assert.deepEqual(await searchYouTubeApi("query", "key", 1), []);

  assert.equal(get.mock.calls.length, 1, "second call must not hit the network");
  assert.equal(log.mock.calls.length, 1, "cooldown must be logged once");
  assert.deepEqual(getYouTubeApiLastError(), {
    status: 403,
    reason: "forbidden",
    message: "Permission denied on the service.",
  });
});

test("non-403 errors do not trigger the cooldown", async (t) => {
  resetYouTubeApiState();
  const failure = Object.assign(new Error("Request failed with status code 500"), {
    response: { status: 500, data: { error: { message: "backend error" } } },
  });
  t.mock.method(axios, "get", async () => { throw failure; });
  t.mock.method(console, "error", () => {});

  assert.deepEqual(await searchYouTubeApi("query", "key", 1), []);
  assert.equal(isYouTubeApiUnavailable(), false);
});

test("resetting state clears the cooldown", async (t) => {
  resetYouTubeApiState();
  const forbidden = { response: { status: 429, data: { error: { message: "quota" } } } };
  t.mock.method(axios, "get", async () => { throw forbidden; });
  t.mock.method(console, "error", () => {});

  await searchYouTubeApi("query", "key", 1);
  assert.equal(isYouTubeApiUnavailable(), true);

  resetYouTubeApiState();
  assert.equal(isYouTubeApiUnavailable(), false);

  const get = t.mock.method(axios, "get", async () => ({ data: { items: [trackItem] } }));
  const tracks = await searchYouTubeApi("query", "key", 1);
  assert.equal(tracks.length, 1);
  assert.equal(get.mock.calls.length, 1);
});

test("decodes common HTML entities", () => {
  assert.equal(decodeHtmlEntities("&amp;&lt;&gt;&quot;&#39;&#65;"), `&<>"'A`);
});
