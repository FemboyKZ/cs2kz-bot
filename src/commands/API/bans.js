const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const axios = require("axios");
require("dotenv").config();

const API_URL = process.env.API_URL || "https://api.cs2kz.org";
const ITEMS_PER_PAGE = 10;

async function fetchBansPage(offset = 0) {
  try {
    const response = await axios.get(`${API_URL}/bans`, {
      params: { offset, limit: ITEMS_PER_PAGE },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching bans:", error);
    return null;
  }
}

function createBanFields(bans) {
  return bans.slice(0, ITEMS_PER_PAGE).map((ban) => ({
    name: ban.player.name,
    value: [
      `**SteamID:** ${ban.player.id}`,
      `**Reason:** ${ban.reason}`,
      `**Banned by:** ${ban.banned_by.type} (${ban.banned_by.id})`,
      `**Date:** ${new Date(ban.created_at).toLocaleDateString()}`,
    ].join("\n"),
    inline: true,
  }));
}

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
                value: new Date(response.data.created_at).toLocaleDateString(),
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
    } else {
      await interaction.deferReply();

      const initialData = await fetchBansPage(0);
      if (!initialData || !initialData.values.length) {
        return interaction.editReply("No active bans found.");
      }

      let currentPage = 1;
      const totalPages = Math.ceil(initialData.total / ITEMS_PER_PAGE);

      const embed = new EmbedBuilder()
        .setTitle("CS2KZ Ban List")
        .setDescription(
          `Page ${currentPage}/${totalPages} (Total ${initialData.total} bans)`,
        )
        .addFields(createBanFields(initialData.values))
        .setColor("#FF0000")
        .setFooter({ text: "Use buttons to navigate between pages" });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev_page")
          .setLabel("Previous")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("next_page")
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(totalPages <= 1),
      );

      const message = await interaction.editReply({
        embeds: [embed],
        components: [buttons],
      });

      const collector = message.createMessageComponentCollector({
        time: 300000, // 5 minutes
      });

      collector.on("collect", async (i) => {
        await i.deferUpdate();

        if (i.customId === "next_page") currentPage++;
        else if (i.customId === "prev_page") currentPage--;

        const offset = (currentPage - 1) * ITEMS_PER_PAGE;
        const pageData = await fetchBansPage(offset);

        if (!pageData) {
          collector.stop();
          return i.editReply({
            content: "Error fetching bans",
            components: [],
          });
        }

        embed
          .setDescription(
            `Page ${currentPage}/${totalPages} (Total ${pageData.total} bans)`,
          )
          .setFields(createBanFields(pageData.values));

        buttons.components[0].setDisabled(currentPage === 1);
        buttons.components[1].setDisabled(currentPage >= totalPages);

        await i.editReply({
          embeds: [embed],
          components: [buttons],
        });
      });

      collector.on("end", () => {
        message.edit({ components: [] }).catch(console.error);
      });
    }
  },
};
