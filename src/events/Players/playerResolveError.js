module.exports = {
  name: "playerResolveError",
  run: async (client, player, track, message) => {
    client.logger?.log(
      `[Player] Failed to resolve "${track?.title || "unknown track"}" in guild ${player.guildId}: ${message}`,
      "error"
    );
  },
};
