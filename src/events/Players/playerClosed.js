module.exports = {
  name: "playerClosed",
  run: async (client, player, data) => {
    client.logger?.log(
      `[Player] Voice WebSocket closed in guild ${player.guildId}: code=${data?.code} reason="${data?.reason || ""}" byRemote=${data?.byRemote}`,
      "warn"
    );
  },
};
