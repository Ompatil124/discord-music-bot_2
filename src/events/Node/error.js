const { failoverNodePlayers } = require("../../utils/nodeFailover");
const lastErrorTime = new Map();
const ERROR_THROTTLE_MS = 60000;

module.exports = {
  name: "error",
  run: async (client, name, error) => {
    const errorKey = `${name}_${error?.code || error?.message || error}`;
    const now = Date.now();
    const lastTime = lastErrorTime.get(errorKey) || 0;

    if (error?.code === 'ETIMEDOUT' || error?.message?.includes('ETIMEDOUT')) {
      if (now - lastTime < ERROR_THROTTLE_MS) {
        return;
      }
      lastErrorTime.set(errorKey, now);
      client.logger.log(`Lavalink "${name}" connection timeout (will retry automatically)`, "warn");
      return;
    }

    client.logger.log(`Lavalink "${name}" error ${error?.message || error}`, "error");

    if (error && error.message && error.message.includes('Session not found')) {
      client.logger.log(`Session lost for node "${name}", failing over affected players...`, "warn");
      await failoverNodePlayers(client, name);
    }
  },
};
