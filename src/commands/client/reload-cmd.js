const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reload-commands")
    .setDescription("[Owner] Reload all commands"),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle("Reload Bot Commands")
      .setColor("Red");

    if (interaction.user.id !== process.env.OWNER_ID) {
      embed.setDescription("This command is restricted to the bot owner!");
      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }

    const client = interaction.client;

    try {
      const clearCache = (dir) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);

          if (stat.isDirectory()) clearCache(filePath);
          if (file.endsWith(".js")) {
            delete require.cache[require.resolve(filePath)];
          }
        }
      };

      clearCache(client.commandsPath);

      await client.handleCommands(client.commandsPath);

      embed.setDescription("Commands reloaded successfully!").setColor("Green");

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    } catch (error) {
      embed.setDescription(`Error reloading commands: ${error.message}`);
      console.error("Reload error:", error);
      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }
  },
};
