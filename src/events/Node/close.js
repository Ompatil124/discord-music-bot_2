const { failoverNodePlayers } = require("../../utils/nodeFailover");

module.exports = {
  name: "close",
  run: async (client, name, code, reason) => {
    if (code && code.toString().includes('ETIMEDOUT')) {
      return;
    }

    client.logger.log(
      `Lavalink ${name}: Closed, Code ${code}, Reason ${reason || "No reason"}`,
      "warn",
    );

    // Failover active players on this node to a healthy backup node
    await failoverNodePlayers(client, name);
  },
};
