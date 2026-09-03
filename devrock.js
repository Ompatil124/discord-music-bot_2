process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('The ready event has been renamed to clientReady')) {
    return;
  }
});
const config = require("./src/config");
const { ClusterManager } = require("discord-hybrid-sharding");
const Logger = require("./src/utils/logger");

try {
  config.validate();
} catch (error) {
  Logger.log(error.message, "error");
  process.exit(1);
}

const manager = new ClusterManager("./index.js", {
  totalShards: "auto",
  shardsPerCluster: 1,
  mode: "process",
  token: config.token,
  respawn: true
});

manager.on("clusterCreate", (cluster) => {
  Logger.system(`Started Cluster #${cluster.id}`);
});

// om_music_bot Banner
console.log(`\x1b[36m
   /\\_/\\  
  ( o.o )  ♫ DC MUSIC
   > ^ <   Music System
\x1b[0m`);
Logger.ready("System Initialized! Spawning Clusters...");

manager.spawn({ timeout: -1 });
