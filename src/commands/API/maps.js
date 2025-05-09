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
const ITEMS_PER_PAGE = 1;
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

const STATES = {
  approved: "✔ Approved",
  invalid: "❌ Invalid",
  "in-testing": "❓ In Testing",
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

async function checkImageExists(url) {
  try {
    const response = await axios.get(url, {
      responseType: "stream",
      timeout: 5000,
    });
    response.data.destroy();
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

function cleanParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([_, v]) => v !== null && v !== undefined && v !== "",
    ),
  );
}

function steamidTo64(steamid) {
  if (!steamid.startsWith("STEAM_")) {
    throw new Error("Invalid SteamID format");
  }
  const STEAMID64_IDENT = 76561197960265728n;
  const parts = steamid.split(":");

  const y = parts[1];
  const z = BigInt(parts[2]);

  let commid = z * 2n;
  if (y === "1") commid += 1n;
  commid += STEAMID64_IDENT;

  return commid;
}

async function handlePagination(interaction, fetchParams, totalCount) {
  await interaction.deferReply();

  try {
    const data = await cachedFetch(`${API_URL}/maps`, {
      ...fetchParams,
      offset: 0,
      limit: ITEMS_PER_PAGE,
    });

    if (!data?.values?.length) {
      const embed = createBaseEmbed()
        .setDescription("No Maps found")
        .setColor(COLORS.RED);
      return interaction.editReply({ embeds: [embed] });
    }

    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
    let currentPage = 1;

    const embed = createBaseEmbed()
      .setDescription(
        `Page ${currentPage}/${totalPages} (Total ${totalCount} Maps)`,
      )
      .addFields(createFields(data.values));

    const image = `https://raw.githubusercontent.com/KZGlobalTeam/cs2kz-images/public/webp/full/${data?.values?.[0]?.name}/1.webp`;
    const checkImage = await checkImageExists(image);
    if (checkImage && checkImage === true) {
      try {
        embed.setImage(image);
      } catch (error) {
        console.error("Error setting image", error);
      }
    }

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
      const data = await cachedFetch(`${API_URL}/maps`, {
        ...fetchParams,
        offset: (newPage - 1) * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
      });

      const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
      const embed = createBaseEmbed()
        .setDescription(
          `Page ${newPage}/${totalPages} (Total ${totalCount} Maps)`,
        )
        .addFields(createFields(data.values));

      const image = `https://raw.githubusercontent.com/KZGlobalTeam/cs2kz-images/public/webp/full/${data?.values?.[0]?.name}/1.webp`;
      const checkImage = await checkImageExists(image);
      if (checkImage && checkImage === true) {
        try {
          embed.setImage(image);
        } catch (error) {
          console.error("Error setting image", error);
        }
      }

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
    .setTitle("CS2KZ Maps")
    .setColor(COLORS.GREEN)
    .setFooter({ text: "CS2KZ API | Data updates every 30 seconds" });
}

function createMappersField(mappers) {
  try {
    return mappers
      .map(
        (mapper) =>
          `[${mapper.name}](<https://cs2kz.org/profile/${mapper.id}>)`,
      )
      .join(", ");
  } catch (error) {
    console.log("Invalid mappers:", mappers, error);
    return "N/A";
  }
}

function createStateField(state, mapName) {
  try {
    return `[${STATES[state]}](<https://cs2kz.org/maps/${mapName}>)`;
  } catch (error) {
    console.log("Invalid state:", state, error);
    return "N/A";
  }
}

function createFields(maps) {
  return maps.map((map) => ({
    name: `#${map.id} ${map.name}`,
    value: [
      `**Courses:** ${map.courses.length}`,
      `**Workshop:** [${map.workshop_id}](<https://steamcommunity.com/sharedfiles/filedetails/?id=${map.workshop_id}>)`,
      `**State**: ${createStateField(map.state, map.name)}`,
      `**Description:** ${map.description || "N/A"}`,
      `**Mappers:** ${createMappersField(map.mappers)}`,
    ].join("\n"),
    inline: false,
  }));
}

function createCourseFields(courses) {
  return courses.map((course, index) => ({
    name: `#${index + 1} ${course.name}`,
    value: [
      `**State**: ${createStateField(course.state, course.name)}`,
      `**Description:** ${course.description || "N/A"}`,
      `**Mappers:** ${createMappersField(course.mappers)}`,
    ].join("\n"),
    inline: true,
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
    .setName("maps")
    .setDescription("List and browse CS2KZ Maps, or search for a specific Map")
    .addStringOption((option) =>
      option
        .setName("search")
        .setDescription("Search by the Map Name or ID")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("workshop_id")
        .setDescription("Filter by the Map's Workshop ID")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Filter by the Map's name")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("state")
        .setDescription(
          "Filter by the Map's state (invalid, in-testing, approved",
        )
        .setRequired(false),
    ),
  async execute(interaction) {
    const search = interaction.options.getString("search");
    const workshop_id = interaction.options.getString("workshop_id");
    const name = interaction.options.getString("name");
    const state = interaction.options.getString("state");

    if (search && /\d+/.test(search)) {
      try {
        const map = await cachedFetch(`${API_URL}/maps/${search}`);
        const embed = createBaseEmbed()
          .addFields(createFields([map]))
          .setColor(COLORS.GREEN);

        return interaction.reply({ embeds: [embed] });
      } catch (error) {
        return handleInteractionError(interaction, error);
      }
    }

    if (state && !Object.keys(STATES).includes(state)) {
      const embed = createBaseEmbed()
        .setDescription(
          `Invalid state. Valid options: ${Object.keys(STATES).join(", ")}`,
        )
        .setColor(COLORS.RED);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const fetchParams = cleanParams({
      workshop_id: workshop_id || undefined,
      name: name || undefined,
      state: state || undefined,
    });

    try {
      const count = await cachedFetch(`${API_URL}/maps`, fetchParams);
      await handlePagination(interaction, fetchParams, count.values.length);
    } catch (error) {
      handleInteractionError(interaction, error);
    }
  },
};
