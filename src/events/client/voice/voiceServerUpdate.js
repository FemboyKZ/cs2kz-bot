const { Events } = require("discord.js");

module.exports = {
  name: Events.VoiceServerUpdate,
  async execute(oldServer, newState, client) {},
};
