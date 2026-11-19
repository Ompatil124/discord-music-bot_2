const { failoverNodePlayers } = require("../../utils/nodeFailover");

module.exports = {
  name: "disconnect",
  run: async (client, name, players, moved) => {
    client.logger.log(`Lavalink ${name}: Disconnected`, "warn");

    if (moved) return;

    // Failover active players on this node to a healthy backup node
    await failoverNodePlayers(client, name);
  },
};
