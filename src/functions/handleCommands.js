const fs = require("fs");
const path = require("path");
const process = require("node:process");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
require("dotenv").config();

module.exports = (client) => {
  client.handleCommands = async (commandsPath) => {
    client.commandsPath = commandsPath;
    client.commandArray = [];
    client.commands = new Map();

    const loadCommands = (dir) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          loadCommands(fullPath);
        } else if (file.endsWith(".js")) {
          const command = require(fullPath);

          if (!command.data || !command.data.name || !command.data.toJSON) {
            console.error(`Invalid command file`);
            continue;
          }

          client.commands.set(command.data.name, command);
          client.commandArray.push(command.data.toJSON());
          //console.log(`Loaded command: ${command.data.name}`);
        }
      }
    };

    const clientId = client.user.id || process.env.CLIENT_ID;
    if (!process.env.TOKEN || !clientId) {
      console.error(
        "Bot token or client ID is not set in the environment variables.",
      );
      client.gracefulShutdown().catch(console.error);
    }

    console.log(`Starting to load commands from: ${commandsPath}`);
    loadCommands(commandsPath);
    console.log(
      `Finished loading commands. Total commands: ${client.commandArray.length}`,
    );
    const rest = new REST({ version: "9" }).setToken(process.env.TOKEN);

    (async () => {
      try {
        console.log("Started refreshing application (/) commands.");

        await rest.put(Routes.applicationCommands(clientId), {
          body: client.commandArray,
        });

        console.log("Successfully reloaded application (/) commands.");
      } catch (error) {
        console.error("Error refreshing commands:", error);
      }
    })();
  };
};
