const config = require("../src/config");
const { getYouTubeApiLastError, searchYouTubeApi } = require("../src/utils/youtubeApi");

(async () => {
  if (!config.youtubeAPIKey) {
    console.error("FAIL: YOUTUBE_API_KEY is not set in .env");
    process.exit(1);
  }

  const tracks = await searchYouTubeApi("never gonna give you up", config.youtubeAPIKey, 1);

  if (!tracks.length) {
    const error = getYouTubeApiLastError();
    console.error("FAIL: YouTube Data API v3 request failed.");
    if (error) {
      console.error(`  status=${error.status ?? "unknown"} reason=${error.reason ?? "unknown"} message=${error.message}`);
    }
    console.error("  Check that YouTube Data API v3 is enabled, the key has no restrictive application filter, and quota is available.");
    process.exit(1);
  }

  console.log(`PASS: ${tracks[0].title} (${tracks[0].id}) by ${tracks[0].author}`);
})().catch((error) => {
  console.error("FAIL:", error.message);
  process.exit(1);
});
