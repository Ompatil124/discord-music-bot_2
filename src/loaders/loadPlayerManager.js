

const { Kazagumo, Plugins, KazagumoTrack } = require("kazagumo");
const { Connectors, LoadType } = require("shoukaku");

const searchEngines = {
  DEEZER: "dzsearch",
  SPOTIFY: "spsearch",
  YOUTUBE: "ytsearch",
  JIO_SAAVAN: "jssearch",
  APPLE_MUSIC: "amsearch",
  YOUTUBE_MUSIC: "ytmsearch"
};

const fallbackEngines = ["ytmsearch", "amsearch", "spsearch", "ytsearch"];

module.exports = function loadPlayerManager(client) {
  const manager = new Kazagumo(
    {
      defaultSearchEngine: client.config.node_source,
      send: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
      }
    },
    new Connectors.DiscordJS(client),
    client.config.nodes,
    client.config.node_options
  );

  manager.shoukaku.on("ready", (name, resumed) => {
    const node = manager.shoukaku.nodes.get(name);
    console.log(`[LAVALINK DEBUG] Node "${name}" is ready. Resumed: ${resumed}. SessionID: ${node?.sessionId}`);
  });

  manager.searchEngines = searchEngines;

  manager.defaultSearchEngine = client.config.node_source;

  manager.search = async function (query, options = {}) {
    const node = [...this.shoukaku.nodes.values()][0];
    if (!node) return { type: "SEARCH", tracks: [] };

    const isUrl = /^https?:\/\//.test(query);

    if (isUrl) {
      const directRes = await node.rest.resolve(query).catch(() => null);
      if (directRes && directRes.loadType !== LoadType.ERROR && directRes.loadType !== LoadType.EMPTY) {
        const processed = processSearchResult(directRes, options.requester);
        if (processed.tracks && processed.tracks.length > 0) {
          return processed;
        }
      }

      if (query.includes('youtube.com') || query.includes('youtu.be')) {
        const videoId = query.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1];
        if (videoId) {
          query = `intitle:${videoId}`;
        }
      }
    }

    const { cleanQuery } = require("../utils/searchFilter");
    const cleaned = cleanQuery(query);
    const queryVariations = (cleaned && cleaned !== query) ? [query, cleaned] : [query];

    let searchEngineList = [options.engine || this.defaultSearchEngine];
    searchEngineList = [...new Set([...searchEngineList, ...fallbackEngines])];

    for (const q of queryVariations) {
      for (const engine of searchEngineList) {
        const searchQuery = `${engine}:${q}`;
        const res = await node.rest.resolve(searchQuery).catch(() => null);

        if (res && res.loadType !== LoadType.ERROR && res.loadType !== LoadType.EMPTY && res.data) {
          const processed = processSearchResult(res, options.requester);
          if (processed.tracks && processed.tracks.length > 0) {
            return processed;
          }
        }
      }
    }

    return { type: "SEARCH", tracks: [] };
  };

  function processSearchResult(res, requester) {
    switch (res.loadType) {
      case LoadType.TRACK:
        return {
          type: "TRACK",
          tracks: [new KazagumoTrack(res.data, requester)]
        };
      case LoadType.PLAYLIST:
        return {
          type: "PLAYLIST",
          playlistName: res.data.info.name,
          tracks: res.data.tracks.map((track) => new KazagumoTrack(track, requester))
        };
      case LoadType.SEARCH: {
        let tracks = res.data.map((track) => new KazagumoTrack(track, requester));
        // If standard song tracks (< 15 mins) exist, prioritize them over 1-hour playlist compilations
        const standardTracks = tracks.filter((t) => {
          const len = t.length || t.info?.length || 0;
          return len > 0 && len <= 900000; // <= 15 minutes
        });
        if (standardTracks.length > 0) {
          tracks = standardTracks;
        }
        return {
          type: "SEARCH",
          tracks
        };
      }
      default:
        return { type: "SEARCH", tracks: [] };
    }
  }

  client.manager = manager;
  return manager;
};