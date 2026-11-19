const axios = require("axios");

const COOLDOWN_MS = 10 * 60 * 1000;

let disabledUntil = 0;
let lastError = null;

function isYouTubeApiUnavailable() {
  return Date.now() < disabledUntil;
}

function getYouTubeApiLastError() {
  return lastError;
}

function resetYouTubeApiState() {
  disabledUntil = 0;
  lastError = null;
}

/**
 * Searches YouTube Data API v3 for video results
 * @param {string} query Search term
 * @param {string} apiKey Google Cloud YouTube Data API v3 Key
 * @param {number} maxResults Maximum results (default: 10, max: 25)
 * @returns {Promise<Array<{title: string, author: string, id: string, uri: string, thumbnail: string}>>}
 */
async function searchYouTubeApi(query, apiKey, maxResults = 10) {
  if (!apiKey || !query || typeof query !== "string" || !query.trim()) return [];
  if (isYouTubeApiUnavailable()) return [];

  try {
    const url = `https://www.googleapis.com/youtube/v3/search`;
    const params = {
      part: "snippet",
      type: "video",
      maxResults: Math.min(Math.max(1, maxResults), 25),
      q: query.trim(),
      key: apiKey
    };

    const response = await axios.get(url, { params, timeout: 2500 });
    const items = response.data?.items || [];

    return items
      .filter(item => item.id?.videoId)
      .map(item => {
        // Decode HTML entities in YouTube titles (e.g., &amp; &#39;)
        const title = decodeHtmlEntities(item.snippet.title || "Unknown Title");
        const author = decodeHtmlEntities(item.snippet.channelTitle || "Unknown Artist");
        const videoId = item.id.videoId;

        return {
          title,
          author,
          id: videoId,
          uri: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || ""
        };
      });
  } catch (error) {
    const status = error.response?.status;
    const apiError = error.response?.data?.error;
    const reason = apiError?.errors?.[0]?.reason || apiError?.details?.[0]?.reason || null;
    const message = apiError?.message || error.message;

    lastError = { status: status || null, reason, message };

    if (status === 403 || status === 429) {
      disabledUntil = Date.now() + COOLDOWN_MS;
      console.error(
        `[YouTube API] Disabled for ${Math.round(COOLDOWN_MS / 60000)} minutes after ${status} ${reason || message}.`
      );
      return [];
    }

    console.error("[YouTube API] Search error:", message);
    return [];
  }
}

function decodeHtmlEntities(text) {
  if (!text) return "";
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
}

module.exports = {
  searchYouTubeApi,
  decodeHtmlEntities,
  isYouTubeApiUnavailable,
  getYouTubeApiLastError,
  resetYouTubeApiState,
};
