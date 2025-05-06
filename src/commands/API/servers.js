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
const ITEMS_PER_PAGE = 5;
const CACHE_TTL = 30000; // 30 seconds
const cache = new Map();

const ERROR_CODES = {
  400: "Invalid request parameters",
  401: "API authentication failed",
  403: "Access forbidden",
  404: "Resource not found",
  500: "Internal server error",
  503: "Service unavailable",
};
const COLORS = {
  RED: "#FF0000",
  GREEN: "#00FF00",
  BLUE: "#0000FF",
  YELLOW: "#FFFF00",
  ORANGE: "#FFA500",
  PINK: "#FFC0CB",
  GRAY: "#808080",
  WHITE: "#FFFFFF",
  BLACK: "#000000",
};

const cachedFetch = async (url, params = {}) => {
  const cacheKey = JSON.stringify({ url, params });
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await axios.get(url, {
      params: cleanParams(params),
    });
    cache.set(cacheKey, {
      data: response.data,
      timestamp: Date.now(),
    });
    return response.data;
  } catch (error) {
    console.error("API Error:", error.message);
    throw error;
  }
};

function cleanParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([_, v]) => v !== null && v !== undefined && v !== "",
    ),
  );
}

async function handlePagination(interaction, fetchParams, currentPage = 1) {
  await interaction.deferReply();

  try {
    const response = await cachedFetch(`${API_URL}/servers`, {
      ...fetchParams,
      offset: (currentPage - 1) * ITEMS_PER_PAGE,
      limit: ITEMS_PER_PAGE,
    });

    const results = response.values || [];
    const hasMore = results.length === ITEMS_PER_PAGE;

    if (results.length === 0) {
      if (currentPage === 1) {
        const embed = createBaseEmbed()
          .setDescription("No servers found for these filters")
          .setColor(COLORS.RED);
        return interaction.editReply({ embeds: [embed] });
      }
      return handlePagination(interaction, fetchParams, currentPage - 1);
    }

    const resultsCount = (currentPage - 1) * ITEMS_PER_PAGE + results.length;
    const pageDisplay = hasMore ? `${currentPage}+` : currentPage.toString();

    const embed = createBaseEmbed()
      .setDescription(`Page ${pageDisplay} (Showing ${resultsCount} servers)`)
      .addFields(createServerFields(results));

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prev_page")
        .setLabel("Previous")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === 1),
      new ButtonBuilder()
        .setCustomId("next_page")
        .setLabel("Next")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!hasMore),
    );

    const message = await interaction.editReply({
      embeds: [embed],
      components: [buttons],
    });

    setupCollector(message, interaction.user, fetchParams);
  } catch (error) {
    handleInteractionError(interaction, error);
  }
}

function setupCollector(message, user, fetchParams) {
  const collector = message.createMessageComponentCollector({
    time: 300000,
    dispose: true,
  });

  collector.on("collect", async (i) => {
    if (i.user.id !== user.id) {
      return i.reply({
        content: "This interaction isn't for you!",
        ephemeral: true,
      });
    }

    await i.deferUpdate();
    const currentPage = parseInt(
      i.message.embeds[0].description.match(/Page (\d+)\+?/)[1],
    );
    const newPage =
      i.customId === "next_page" ? currentPage + 1 : currentPage - 1;

    await handlePagination(i, fetchParams, newPage);
  });

  collector.on("end", () => {
    if (!message.deleted) {
      message.edit({ components: [] }).catch(() => {});
    }
  });
}

function createBaseEmbed() {
  return new EmbedBuilder()
    .setTitle("CS2KZ Servers")
    .setColor(COLORS.BLUE)
    .setFooter({ text: "CS2KZ API | Data updates every 30 seconds" });
}

function createServerFields(servers) {
  return servers.map((server) => ({
    name: `#${server.id} ${server.name}`,
    value: [
      `**IP:Port:** ${server.host}:${server.port}`,
      `**Owner:** ${server.owner.name} (${server.owner.id})`,
      `**Approved:** ${new Date(server.approved_at).toLocaleDateString()}`,
    ].join("\n"),
    inline: false,
  }));
}

function handleInteractionError(interaction, error) {
  const status = error.response?.status || 500;
  const description = ERROR_CODES[status] || "An unexpected error occurred";

  const embed = createBaseEmbed()
    .setDescription(`${description}`)
    .setColor(COLORS.RED);

  if (interaction.deferred || interaction.replied) {
    interaction.editReply({ embeds: [embed] }).catch(console.error);
  } else {
    interaction
      .reply({ embeds: [embed], ephemeral: true })
      .catch(console.error);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("servers")
    .setDescription(
      "List and browse CS2KZ servers, or search for a specific server",
    )
    .addStringOption((option) =>
      option
        .setName("search")
        .setDescription("Search by server name or ID")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("owner")
        .setDescription("Filter by owner SteamID")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("host")
        .setDescription("Filter by host IP or domain")
        .setRequired(false),
    ),
  async execute(interaction) {
    const search = interaction.options.getString("search");
    const owner = interaction.options.getString("owner");
    const host = interaction.options.getString("host");

    if (search && /\d+/.test(search)) {
      try {
        const server = await cachedFetch(`${API_URL}/servers/${search}`);
        const embed = createBaseEmbed()
          .addFields(createServerFields([server]))
          .setColor(COLORS.BLUE);

        return interaction.reply({ embeds: [embed] });
      } catch (error) {
        return handleInteractionError(interaction, error);
      }
    }

    const fetchParams = cleanParams({
      owned_by: owner,
      host: host,
    });

    try {
      await handlePagination(interaction, fetchParams, 1);
    } catch (error) {
      handleInteractionError(interaction, error);
    }
  },
};
