const { migratePlayer } = require("../../utils/nodeFailover");

module.exports = {
  name: "playerException",
  run: async (client, player, data) => {
    const exception = data?.exception || {};
    const message = exception.message || exception.cause || "Unknown track exception";
    const severity = exception.severity || "unknown";
    const title = data?.track?.info?.title || player?.queue?.current?.title || "unknown track";

    client.logger?.log(
      `[Player] Track exception in guild ${player?.guildId} (${severity}): "${title}" - ${message}`,
      "error"
    );

    // Attempt failover to another node to see if another node can play it
    const currentNode = player?.node?.name || player?.shoukaku?.node?.name;
    const healthyNodes = [...(client.manager?.shoukaku?.nodes?.values() || [])].filter(
      (n) => n.state === 1 && n.name !== currentNode
    );

    if (healthyNodes.length > 0) {
      client.logger?.log(
        `[Player] Attempting node failover for "${title}" in guild ${player?.guildId}...`,
        "warn"
      );
      const migrated = await migratePlayer(client, player, currentNode);
      if (migrated) return;
    }

    // If failover wasn't possible or failed, skip to next song so music continues
    try {
      if (player && (player.playing || player.paused || player.queue?.current)) {
        await player.skip();
      }
    } catch {}
  },
};
