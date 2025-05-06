const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const process = require("node:process");

require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Channel,
    Partials.GuildMember,
    Partials.Message,
    Partials.ThreadMember,
    Partials.User,
  ],
  presence: { status: "online", game: { name: "Kreedz" } },
});
exports.client = client;

client.commands = new Collection();
//client.cooldowns = new Collection();

const utilsPath = path.join(__dirname, "utils");
require(path.join(utilsPath, "handleConsole.js"));

client.gracefulShutdown = async function () {
  return process.exit(0);
};

if (!process.env.TOKEN) {
  console.error("Bot token is not set in the environment variables.");
  client.gracefulShutdown().catch(console.error);
}

const functionsPath = path.join(__dirname, "functions");
const functions = fs
  .readdirSync(functionsPath)
  .filter((file) => file.endsWith(".js"));

const eventsPath = path.join(__dirname, "events");

(async () => {
  try {
    await client.login(process.env.TOKEN);
    let file;
    for (file of functions) {
      require(`${functionsPath}/${file}`)(client);
    }
    await client.handleEvents(path.join(eventsPath, "client"));
    await client.handleProcessEvents(path.join(eventsPath, "process"));
    await client.handleRestEvents(path.join(eventsPath, "rest"));
    await client.handleCommands(path.join(__dirname, "commands"));
  } catch (error) {
    console.error("Error starting the bot:", error);
  }
})();
