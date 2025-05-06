const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const { spawn } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const execAsync = promisify(require("child_process").exec);

const config = require("./csgo-server-config.json")[0];
require("dotenv").config();

const MANAGER_ROLE = process.env.CSGO_MANAGER_ROLE;
const EMBED_COLOR = "#ff00b3";
const API_URL = new URL(process.env.API_URL);
const API_FULL_URL = `${API_URL.origin}:${process.env.API_PORT || 8080}${API_URL.pathname}`;
const STATUS_SCRIPT = path.join(
  __dirname,
  "..",
  "..",
  "scripts",
  "query_server.py",
);

function createEmbed(description, color = EMBED_COLOR) {
  return new EmbedBuilder()
    .setColor(color)
    .setTimestamp()
    .setTitle("FKZ CSGO Server Commands")
    .setFooter({ text: "FKZ" })
    .setDescription(description);
}

const resolveServerConfig = (serverId) => {
  if (serverId === "all") {
    return Object.values(config).map((server) => ({
      ip: server.ip,
      port: server.port,
      name: server.name,
      type: server.type,
      user: server.user,
      id: server.id,
    }));
  }

  if (serverId) {
    const server = config[serverId];
    if (!server) throw new Error("Invalid server selection");
    return [
      {
        ip: server.ip,
        port: server.port,
        name: server.name,
        type: server.type,
        user: server.user,
        id: server.id,
      },
    ];
  }

  return [];
};

const queryServerStatus = async (ip, port) => {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn("python3", [STATUS_SCRIPT, ip, port]);
    let dataBuffer = "";

    pythonProcess.stdout.on("data", (data) => (dataBuffer += data));
    pythonProcess.stderr.on("data", reject);
    pythonProcess.on("close", (code) => {
      if (code !== 0) reject(`Python script exited with code ${code}`);
      try {
        resolve(JSON.parse(dataBuffer).status);
      } catch (e) {
        reject("Invalid JSON response");
      }
    });
  });
};

const commandHandlers = {
  local: async (action, { user }) => {
    const command = `sudo -iu csgo-${user} /home/csgo-${user}/csgoserver ${action}`;
    const { stderr } = await execAsync(command);
    if (stderr) throw new Error(`Local command failed: ${stderr}`);
  },

  api: async (action, { user }) => {
    const command = [
      "curl -X POST",
      `-H 'authorization: ${process.env.API_KEY}'`,
      '-H "Content-Type: application/json"',
      `-d '{"user": "${user}", "game": "csgo", "command": "${action}"}'`,
      API_FULL_URL,
    ].join(" ");

    const { stderr } = await execAsync(command);
    if (stderr) throw new Error(`API command failed: ${stderr}`);
  },

  dathost: async (action, { id }) => {
    const url = `https://dathost.net/api/0.1/game-servers/${id}`;
    const auth = `-u "${process.env.DATHOST_USERNAME}:${process.env.DATHOST_PASSWORD}"`;

    if (action === "restart") {
      await execAsync(`curl ${auth} -X POST "${url}/stop"`);
      await execAsync(`curl ${auth} -X POST "${url}/start"`);
    } else {
      await execAsync(`curl ${auth} -X POST "${url}/${action}"`);
    }
  },
};

const serverChoices = Object.entries(config).map(([id, { name }]) => ({
  name,
  value: id,
}));

module.exports = {
  data: new SlashCommandBuilder()
    .setName("csgo-server")
    .setDescription("[ADMIN] Manage CSGO servers")
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("Server action")
        .setRequired(true)
        .addChoices(
          { name: "Start", value: "start" },
          { name: "Restart", value: "restart" },
          { name: "Stop", value: "stop" },
        ),
    )
    .addStringOption((option) =>
      option
        .setName("server")
        .setDescription("Select configured server")
        .setRequired(true)
        .addChoices(...serverChoices, { name: "All Servers", value: "all" }),
    )
    .addBooleanOption((option) =>
      option
        .setName("force")
        .setRequired(false)
        .setDescription("Force action regardless of status"),
    ),

  async execute(interaction) {
    try {
      const role = await interaction.guild.roles.fetch(MANAGER_ROLE);
      if (!role) {
        console.log("Manager role not found in guild", MANAGER_ROLE);
      }
      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.Administrator,
        ) &&
        !interaction.member.roles.cache.has(MANAGER_ROLE)
      ) {
        return await interaction.reply({
          content: "You don't have perms to use this command.",
          ephemeral: true,
        });
      }
    } catch (e) {
      console.error(e);
      return await interaction.reply({
        content: "Error checking permissions.",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      if (!config || Object.keys(config).length === 0) {
        return interaction.editReply({
          embeds: [createEmbed("No servers configured", EMBED_COLOR)],
          ephemeral: true,
        });
      }

      const options = {
        action: interaction.options.getString("action"),
        serverId: interaction.options.getString("server"),
        force: interaction.options.getBoolean("force") || false,
      };

      const servers = resolveServerConfig(options.serverId);

      const allowedActions = {
        start: ["OFFLINE"],
        restart: ["ACTIVE", "EMPTY"],
        stop: ["ACTIVE", "EMPTY"],
      };

      const results = [];
      for (const server of servers) {
        try {
          let status;
          if (!options.force) {
            status = await queryServerStatus(server.ip, server.port);
            if (!allowedActions[options.action].includes(status)) {
              results.push({
                server,
                success: false,
                error: `Cannot ${options.action} (Status: ${status})`,
              });
              continue;
            }
          }

          if (commandHandlers[server.type]) {
            await commandHandlers[server.type](options.action, server);
            results.push({ server, success: true });
          } else {
            throw new Error(`Unsupported server type: ${server.type}`);
          }
        } catch (error) {
          results.push({ server, success: false, error: error.message });
        }
      }

      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      let description = `Action **${options.action}** executed on **${successful.length}** server${successful.length !== 1 ? "s" : ""}.`;
      if (successful.length > 0) {
        description += `\n\nSuccessful:`;
        successful.forEach((s) => {
          description += `\n\`${s.server.name} (${s.server.ip}:${s.server.port})\``;
        });
      }
      if (failed.length > 0) {
        description += `\n\nFailed:`;
        failed.forEach((f) => {
          description += `\n\`${f.server.name}: ${f.error}\``;
        });
      }

      await interaction.editReply({
        embeds: [createEmbed(description, EMBED_COLOR)],
        ephemeral: true,
      });
    } catch (error) {
      await interaction.editReply({
        embeds: [createEmbed(`Command failed: ${error.message}`, EMBED_COLOR)],
        ephemeral: true,
      });
      console.error("CSGO Server Command Error:", error);
    }
  },
};
