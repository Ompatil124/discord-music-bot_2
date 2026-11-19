module.exports = {
  name: "playerEnd",
  run: async (client, player, track) => {
    try {
      if (track?.title) {
        client.logger?.log(`[Player] Track ended in guild ${player.guildId}: "${track.title}"`, "debug");
      }
      const message = player.data?.get("nowPlayingMessage");
      if (message) {
        await message.delete().catch(() => { });
        player.data?.delete("nowPlayingMessage");
      }
      if (!player.queue?.current && !player.playing) {
        const { syncVoiceChannelStatus } = require("../../utils/voiceChannelStatus");
        await syncVoiceChannelStatus(client, player, { state: "idle" });
      }
    } catch (error) {
      console.error("Error in playerEnd event:", error);
    }
  },
};
