const { refreshNowPlayingMessage } = require("./playerStart");
const { syncVoiceChannelStatus } = require("../../utils/voiceChannelStatus");

module.exports = {
  name: "playerCreate",
  run: async (client, player) => {
    if (!player.data) player.data = new Map();
    if (!player.data.get("volumeUiHook")) {
      const setVolume = player.setVolume.bind(player);
      player.setVolume = async (volume) => {
        const result = await setVolume(volume);
        await refreshNowPlayingMessage(client, player);
        return result;
      };
      player.data.set("volumeUiHook", true);
    }

    if (process.env.DEBUG_PLAY === "true" && !player.data.get("playLogHook")) {
      const play = player.play.bind(player);
      player.play = async (...args) => {
        const current = player.queue?.current;
        console.log(
          `[Play] guild=${player.guildId} state=${player.state} playing=${player.playing} paused=${player.paused} ` +
          `queue=${player.queue?.size ?? 0} current="${current?.title || "none"}" encoded=${!!current?.track}`
        );
        try {
          const result = await play(...args);
          console.log(
            `[Play] guild=${player.guildId} result state=${player.state} playing=${player.playing} current="${player.queue?.current?.title || "none"}"`
          );
          return result;
        } catch (error) {
          console.error(`[Play] guild=${player.guildId} failed:`, error);
          throw error;
        }
      };
      player.data.set("playLogHook", true);
    }

    const track = player.queue?.current;
    await syncVoiceChannelStatus(client, player, {
      track,
      state: track ? "playing" : "idle",
    });

    try {
      const { sendWebhook } = require("../../utils/webhooks");
      const { EmbedBuilder } = require("discord.js");
      const guild = client.guilds.cache.get(player.guildId);
      const voice = client.channels.cache.get(player.voiceId);
      const playerEmbed = new EmbedBuilder()
        .setColor(client.color)
        .setTitle("🎧 Music Player Created")
        .setDescription(
          `**${client.emoji?.dot || "•"} Server:** \`${guild?.name || player.guildId}\`\n` +
          `**${client.emoji?.dot || "•"} Voice Channel:** \`${voice?.name || player.voiceId}\`\n` +
          `**${client.emoji?.dot || "•"} Lavalink Node:** \`${player.node?.name || "Nazha"}\``
        )
        .setTimestamp();
      await sendWebhook(client, "player_create", { embeds: [playerEmbed] });
    } catch (e) {}
  },
};
