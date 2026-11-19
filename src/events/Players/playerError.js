module.exports = {
  name: "playerError",
  run: async (client, player, error) => {
    client.logger?.log(`[Player] Error in guild ${player?.guildId || "unknown"}: ${error?.message || error}`, "error");
  },
};
