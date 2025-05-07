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
    console.error(
      "API Error:",
      error.message,
      "\nURL:",
      url,
      "Params:",
      params,
    );
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

async function handlePagination(interaction, fetchParams, totalCount) {
  await interaction.deferReply();

  try {
    const initialData = await cachedFetch(`${API_URL}/users`, {
      ...fetchParams,
      offset: 0,
      limit: ITEMS_PER_PAGE,
    });

    if (!initialData?.values?.length) {
      const embed = createBaseEmbed()
        .setDescription("No Admins found")
        .setColor(COLORS.RED);
      return interaction.editReply({ embeds: [embed] });
    }

    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
    let currentPage = 1;

    const embed = createBaseEmbed()
      .setDescription(
        `Page ${currentPage}/${totalPages} (Total ${totalCount} Admins)`,
      )
      .addFields(createFields(initialData.values));

    const buttons = createPaginationButtons(totalPages, currentPage);
    const message = await interaction.editReply({
      embeds: [embed],
      components: [buttons],
    });

    setupCollector(message, interaction.user, fetchParams, totalCount);
  } catch (error) {
    handleInteractionError(interaction, error);
  }
}

function createPaginationButtons(totalPages, currentPage) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("prev_page")
      .setLabel("Previous")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === 1),
    new ButtonBuilder()
      .setCustomId("next_page")
      .setLabel("Next")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage >= totalPages),
  );
}

function setupCollector(message, user, fetchParams, totalCount) {
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
      i.message.embeds[0].description.match(/Page (\d+)/)[1],
    );
    const newPage =
      i.customId === "next_page" ? currentPage + 1 : currentPage - 1;

    try {
      const newData = await cachedFetch(`${API_URL}/users`, {
        ...fetchParams,
        offset: (newPage - 1) * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
      });

      const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
      const embed = createBaseEmbed()
        .setDescription(
          `Page ${newPage}/${totalPages} (Total ${totalCount} Admins)`,
        )
        .addFields(createFields(newData.values));

      const buttons = createPaginationButtons(totalPages, newPage);
      await i.editReply({ embeds: [embed], components: [buttons] });
    } catch (error) {
      handleInteractionError(i, error);
      collector.stop();
    }
  });

  collector.on("end", () => {
    if (!message.deleted) {
      message.edit({ components: [] }).catch(() => {});
    }
  });
}

function createBaseEmbed() {
  return new EmbedBuilder()
    .setTitle("CS2KZ Admins")
    .setColor(COLORS.ORANGE)
    .setFooter({ text: "CS2KZ API | Data updates every 30 seconds" });
}

function createFields(users) {
  return users.map((user) => ({
    name: `${user.name}`,
    value: [
      `**SteamID:** ${user.id}`,
      `**Permissions:** ${user.permissions.join(", ")}`,
      `**Registered:** ${new Date(user.registered_at).toLocaleDateString()}`,
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
    .setName("admins")
    .setDescription(
      "List and browse CS2KZ Admins, or search for a specific Admin",
    )
    .addStringOption((option) =>
      option
        .setName("search")
        .setDescription("Search by Admin SteamID")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("perms")
        .setDescription(
          "Filter by the Admin's permissions (user-permissions, servers, map-pool, player-bans)",
        )
        .setRequired(false),
    ),
  async execute(interaction) {
    const search = interaction.options.getString("search");

    const [perms] = interaction.options.getString("perms");

    if (search && /\d+/.test(search)) {
      try {
        const user = await cachedFetch(`${API_URL}/users/${search}`);
        const embed = createBaseEmbed().addFields(createFields([user]));

        return interaction.reply({ embeds: [embed] });
      } catch (error) {
        return handleInteractionError(interaction, error);
      }
    }

    const fetchParams = cleanParams({
      permissions: perms || undefined,
    });

    try {
      const count = await cachedFetch(`${API_URL}/users`, fetchParams);
      await handlePagination(interaction, fetchParams, count.values.length);
    } catch (error) {
      handleInteractionError(interaction, error);
    }
  },
};
