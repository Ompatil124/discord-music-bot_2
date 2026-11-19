const { prefix } = require("../../config.js");
const { ActivityType, REST, Routes } = require("discord.js");
const { syncApplicationEmojis } = require("../../utils/applicationEmojis");

module.exports = {
  name: "clientReady",
  run: async (client) => {
    client.emojiReady = syncApplicationEmojis(client);
    try {
      await client.emojiReady;
    } catch (error) {
      client.logger.log(`[Emoji sync] ${error.message}`, "error");
    }

    client.logger.log(`${client.user.username} is now online.`, "ready");
    client.logger.log(
      `Ready on ${client.guilds.cache.size} servers, for a total of ${client.users.cache.size} users`,
      "ready",
    );

    try {
      const { sendWebhook } = require("../../utils/webhooks");
      const readyEmbed = new EmbedBuilder()
        .setColor(client.color)
        .setTitle("🟢 Bot Started & Online")
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setDescription(
          `**${client.user.username}** is now online!\n\n` +
          `**${client.emoji?.dot || "•"} Servers:** \`${client.guilds.cache.size}\`\n` +
          `**${client.emoji?.dot || "•"} Total Users:** \`${client.users.cache.size}\`\n` +
          `**${client.emoji?.dot || "•"} Prefix Commands:** \`${client.commands?.size || 0}\`\n` +
          `**${client.emoji?.dot || "•"} Slash Commands:** \`${client.slashCommands?.size || 0}\`\n` +
          `**${client.emoji?.dot || "•"} Shard:** \`0 / ${client.clusterInfo?.TOTAL_SHARDS || 1}\``
        )
        .setTimestamp();
      await sendWebhook(client, "system", { embeds: [readyEmbed] });
    } catch (e) {
      // Ignore webhook errors
    }

    if (client.slashCommands.size > 0) {
      const rest = new REST({ version: "10" }).setToken(client.token);
      try {
        const commands = Array.from(client.slashCommands.values()).map((cmd) => {
          const commandData = {
            name: cmd.name,
            description: cmd.description,
            options: cmd.options || [],
          };

          if (cmd.owner) {
            commandData.default_member_permissions = "8";
            commandData.dm_permission = false;
          }

          return commandData;
        });

        client.logger.log(`Deploying ${commands.length} slash commands...`, "cmd");

        await rest.put(Routes.applicationCommands(client.user.id), {
          body: commands,
        });

        client.logger.log(`Successfully deployed ${commands.length} slash commands.`, "cmd");
      } catch (error) {
        console.error("Error deploying slash commands:", error);
      }
    } else {
      console.log("\nWARNING: No slash commands to deploy! client.slashCommands.size = 0\n");
    }

    client.user.setPresence({
      activities: [],
      status: "online",
    });

    try {
      setTimeout(async () => {
        try {
          const TwoFourSeven = require("../../schema/247");
          const entries = await TwoFourSeven.find();
          if (!entries || entries.length === 0) {
            return;
          }

          const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

          for (const data of entries) {
            try {
              const text = client.channels.cache.get(data.TextId);
              const voice = client.channels.cache.get(data.VoiceId);
              if (!text || !voice) continue;

              const guild = voice.guild;
              const me = guild.members.cache.get(client.user.id);
              if (!me) continue;
              const perms = voice.permissionsFor(me);
              if (!perms || !perms.has(["Connect", "Speak"])) continue;

              let player = client.manager.players.get(data.Guild);
              if (!player) {
                try {
                  player = await client.manager.createPlayer({
                    guildId: data.Guild,
                    voiceId: data.VoiceId,
                    textId: data.TextId,
                    deaf: true,
                    volume: 80,
                  });
                  client.voiceHealthMonitor?.startMonitoring(player);
                  client.logger.log(
                    `Auto Reconnect (clientReady): joined ${voice.name} in ${guild.name}`,
                    "ready"
                  );
                } catch (e) {
                  client.logger.log(
                    `Auto Reconnect (clientReady) failed for guild ${data.Guild}: ${e.message || e}`,
                    "warn"
                  );
                }
                await sleep(300);
              }
            } catch {}
          }
        } catch {}
      }, 5000);
    } catch {}
  },
};

