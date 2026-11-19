module.exports = {
  name: "playerStuck",
  run: async (client, player, data) => {
    const title = player?.queue?.current?.title || "unknown track";
    client.logger?.log(
      `[Player] Track stuck in guild ${player?.guildId || "unknown"} after ${data?.thresholdMs || "unknown"}ms ("${title}"). Auto-skipping to next track...`,
      "warn"
    );

    try {
      if (player && (player.playing || player.paused || player.queue?.current)) {
        await player.skip();
      }
    } catch (error) {
      client.logger?.log(
        `[Player] Failed to auto-skip stuck track in guild ${player?.guildId}: ${error.message}`,
        "error"
      );
    }
  },
};
