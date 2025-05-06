const { Events } = require("discord.js");
require("dotenv").config();

module.exports = {
  name: Events.ClientReady,
  async execute(client) {
    console.log(`Client ready as ${client.user.tag} (${client.user.id})`);
  },
};
