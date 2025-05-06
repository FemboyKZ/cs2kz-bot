const { Events } = require("discord.js");

module.exports = {
  name: Events.GuildScheduledEventUpdate,
  async execute(oldGuildScheduledEvent, newGuildScheduledEvent, client) {},
};
