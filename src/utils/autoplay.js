const VARIANT_SOURCE = "\\b(?:official|audio|video|lyrics?|lyric video|hd|4k|remaster(?:ed)?|mv|visuali[sz]er|live|cover|karaoke|instrumental|slowed|reverb|sped up|nightcore|edit|version)\\b";
const VARIANT_WORDS = new RegExp(VARIANT_SOURCE, "gi");
const HAS_VARIANT_WORD = new RegExp(VARIANT_SOURCE, "i");

function normalizeTrackText(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/\s*-\s*topic\s*$/i, "")
    .replace(/[([].*?[)\]]/g, (part) => HAS_VARIANT_WORD.test(part) ? " " : part)
    .replace(VARIANT_WORDS, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function youtubeId(uri) {
  return String(uri || "").match(/(?:v=|\/vi?\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1] || null;
}

function spotifyId(uri) {
  return String(uri || "").match(/track\/([a-zA-Z0-9]+)/)?.[1] || null;
}

function trackKeys(track) {
  if (!track) return [];
  const title = normalizeTrackText(track.title);
  const author = normalizeTrackText(track.author);
  const keys = [
    track.identifier ? `id:${track.identifier}` : null,
    youtubeId(track.uri) ? `youtube:${youtubeId(track.uri)}` : null,
    track.uri ? `uri:${track.uri}` : null,
    title ? `title:${title}` : null,
    title && author ? `song:${title}|${author}` : null,
  ];
  return [...new Set(keys.filter(Boolean))];
}

function isSameSong(first, second) {
  if (!first || !second) return false;
  const firstKeys = new Set(trackKeys(first));
  if (trackKeys(second).some((key) => firstKeys.has(key))) return true;
  const firstTitle = normalizeTrackText(first.title);
  const secondTitle = normalizeTrackText(second.title);
  return Boolean(firstTitle && secondTitle && firstTitle === secondTitle);
}

function isJunkTrack(track) {
  if (!track || !track.title) return true;
  if (track.isStream) return true;

  const length = Number(track.length || track.info?.length || 0);
  // Real songs are almost always between 60s (1 min) and 11 minutes (660,000ms)
  // Exclude snippets (<60s) and full concerts / continuous live streams (>11 mins)
  if (length > 0 && (length < 60_000 || length > 660_000)) {
    return true;
  }

  const title = String(track.title || "").toLowerCase();

  // Reject segments, live parts, episodes, podcasts, and non-music clips
  const junkPatterns = [
    /\bpart\s*[-–—:]*\s*\d+\b/i,          // "Part - 10", "Part 1", "Part-2"
    /\b(?:part|pt)\.?\s*\d+\b/i,           // "Pt. 1", "pt 2"
    /\blive\s*\([^)]*part\s*\d+[^)]*\)/i, // "Live (Part - 10)"
    /\b(?:episode|ep)\.?\s*\d+\b/i,        // "Episode 5", "Ep 12"
    /\b(?:podcast|interview|speech|vlog|behind the scenes|making of|teaser|trailer|promo)\b/i,
    /\b(?:shorts?|reels?|whatsapp status|status video)\b/i,
    /\b(?:full\s*(?:album|movie|episode|show|concert|event|match))\b/i,
    /\b(?:jukebox|non[\s-]*stop|mega[\s-]*mix)\b/i
  ];

  return junkPatterns.some((pattern) => pattern.test(title));
}

function selectAutoplayCandidate(source, tracks, recentKeys = []) {
  if (!Array.isArray(tracks) || tracks.length === 0) return null;
  const blocked = new Set(recentKeys);

  // Filter out junk/live segments/episodes so only actual music songs are queued
  const validTracks = tracks.filter((track) => track?.title && !isJunkTrack(track));
  const pool = validTracks.length > 0 ? validTracks : tracks;

  // 1. Try finding a fresh track not in recent history
  const freshCandidate = pool.find((track) =>
    track?.title &&
    !isSameSong(source, track) &&
    !trackKeys(track).some((key) => blocked.has(key))
  );

  if (freshCandidate) return freshCandidate;

  // 2. Fallback: pick any track that isn't the exact same track currently playing
  return pool.find((track) => track?.title && !isSameSong(source, track)) || pool[0] || null;
}

function buildAutoplaySearches(track) {
  const searches = [];
  const author = normalizeTrackText(track?.author);
  const title = normalizeTrackText(track?.title);

  if (author) {
    searches.push(["ytmsearch", `${author} radio`]);
    searches.push(["ytmsearch", `${author} top tracks`]);
  }

  const sId = spotifyId(track?.uri) || (track?.sourceName === 'spotify' ? track?.identifier : null);
  if (sId) {
    searches.push(["sprec", `seed_tracks=${sId}`]);
  }

  const yId = youtubeId(track?.uri) || (track?.sourceName === 'youtube' ? track?.identifier : null);
  if (yId) {
    searches.push(["ytmsearch", `https://music.youtube.com/watch?v=${yId}&list=RD${yId}`]);
    searches.push(["ytsearch", `https://www.youtube.com/watch?v=${yId}&list=RD${yId}`]);
  }

  const related = [title, author].filter(Boolean).join(" ");

  searches.push(
    ["ytmsearch", related],
    ["spsearch", related],
    ["scsearch", related],
    ["dzsearch", related]
  );
  
  return searches.filter(([, query]) => query);
}

function rememberTracks(existing, tracks, limit = 40) {
  const added = tracks.flatMap(trackKeys);
  return [...new Set([...added, ...(existing || [])])].slice(0, limit);
}

module.exports = {
  buildAutoplaySearches,
  isJunkTrack,
  isSameSong,
  normalizeTrackText,
  rememberTracks,
  selectAutoplayCandidate,
  trackKeys,
};
