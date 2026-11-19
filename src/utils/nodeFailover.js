/**
 * Lavalink Automatic Server Failover
 * Seamlessly migrates players when a Lavalink node fails or disconnects.
 */

async function migratePlayer(client, player, fromNodeName) {
  if (!client?.manager?.shoukaku) return false;

  const connectedNodes = [...client.manager.shoukaku.nodes.values()].filter(
    (n) => n.state === 1 && n.name !== fromNodeName
  );

  if (!connectedNodes.length) {
    client.logger?.log(
      `[Lavalink Failover] Cannot migrate player in guild ${player.guildId}: no other healthy Lavalink node connected.`,
      "error"
    );
    return false;
  }

  // Pick node with lowest penalties
  const targetNode = connectedNodes.sort((a, b) => a.penalties - b.penalties)[0];

  client.logger?.log(
    `[Lavalink Failover] Migrating guild ${player.guildId} from "${fromNodeName || player.node?.name || "unknown"}" to "${targetNode.name}"...`,
    "warn"
  );

  // 1. Try Shoukaku's native player move
  try {
    if (player.shoukaku && typeof player.shoukaku.move === "function") {
      const moved = await player.shoukaku.move(targetNode.name);
      if (moved) {
        client.logger?.log(
          `[Lavalink Failover] Seamlessly moved guild ${player.guildId} to "${targetNode.name}"`,
          "ready"
        );
        return true;
      }
    }
  } catch (moveErr) {
    client.logger?.log(
      `[Lavalink Failover] Shoukaku move for guild ${player.guildId} failed (${moveErr.message}). Recreating player on "${targetNode.name}"...`,
      "warn"
    );
  }

  // 2. Fallback: Recreate player and queue on the target node
  try {
    const currentTrack = player.queue?.current;
    const remainingQueue = [...(player.queue || [])];
    const textId = player.textId;
    const voiceId = player.voiceId;
    const guildId = player.guildId;
    const isPaused = player.paused;

    await player.destroy().catch(() => {});

    const newPlayer = await client.manager.createPlayer({
      guildId,
      voiceId,
      textId,
      volume: 80,
      deaf: true,
    });

    if (currentTrack) {
      newPlayer.queue.add(currentTrack);
    }
    for (const track of remainingQueue) {
      newPlayer.queue.add(track);
    }

    if (currentTrack && !isPaused) {
      await newPlayer.play();
    }

    client.logger?.log(
      `[Lavalink Failover] Successfully rebuilt and resumed player for guild ${guildId} on "${targetNode.name}"`,
      "ready"
    );
    return true;
  } catch (error) {
    client.logger?.log(
      `[Lavalink Failover] Recreating player failed in guild ${player.guildId}: ${error.message}`,
      "error"
    );
    return false;
  }
}

async function failoverNodePlayers(client, nodeName) {
  if (!client?.manager?.players) return;

  const affectedPlayers = [...client.manager.players.values()].filter(
    (p) => p.node?.name === nodeName || p.shoukaku?.node?.name === nodeName
  );

  if (!affectedPlayers.length) return;

  client.logger?.log(
    `[Lavalink Failover] Initiating failover for ${affectedPlayers.length} active player(s) on node "${nodeName}"...`,
    "warn"
  );

  for (const player of affectedPlayers) {
    await migratePlayer(client, player, nodeName);
  }
}

module.exports = {
  migratePlayer,
  failoverNodePlayers,
};
