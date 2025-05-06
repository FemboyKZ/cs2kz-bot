const { Events } = require("discord.js");

module.exports = {
  name: Events.MessageReactionRemoveEmoji,
  async execute(reaction, client) {
    // How does this differ from the MessageReactionRemove event?
  },
};
