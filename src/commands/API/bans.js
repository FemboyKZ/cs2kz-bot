const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const axios = require("axios");
require("dotenv").config();

const API_URL = process.env.API_URL || "https://api.cs2kz.org";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bans")
    .setDescription("Get a list of banned users or search for a specific user")
    .addStringOption((option) =>
      option
        .setName("steamid")
        .setDescription("User's SteamID to search")
        .setRequired(false),
    ),
  async execute(interaction) {
    const steamID = interaction.options.getString("steamid") || null;

    if (steamID) {
      const options = {
        method: "GET",
        url: API_URL + "/bans/" + steamID,
      };

      const embed = new EmbedBuilder()
        .setTitle("CS2KZ Bans")
        .setFooter({ text: "CS2KZ API" })
        .setTimestamp();

      try {
        const response = await axios.request(options);
        if (response.status === 200) {
          embed
            .setDescription("User is banned!")
            .setColor("Red")
            .addFields(
              {
                name: "User",
                value:
                  response.data.played.name + " - " + response.data.played.id,
              },
              {
                name: "Reason",
                value: response.data.reason || "No reason provided",
              },
              {
                name: "Banned by",
                value:
                  response.data.banned_by.type +
                  " - " +
                  response.data.banned_by.id,
              },
              {
                name: "Date",
                value: response.data.created_at,
              },
            );
          await interaction.reply({ embeds: [embed], ephemeral: false });
        } else if (response.status === 404) {
          embed.setDescription("API Request denied!").setColor("Orange");
          await interaction.reply({ embeds: [embed], ephemeral: true });
        } else {
          embed
            .setDescription("No bans found matching steamID: " + steamID)
            .setColor("Green");
          await interaction.reply({ embeds: [embed], ephemeral: false });
        }
      } catch (error) {
        embed
          .setDescription("Something went wrong while executing the command!")
          .setColor("Orange");
        await interaction.reply({ embeds: [embed], ephemeral: true });
        console.error(error);
      }
    }
  },
};
