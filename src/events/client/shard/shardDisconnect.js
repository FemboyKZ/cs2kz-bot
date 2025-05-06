const { Events } = require("discord.js");

module.exports = {
  name: Events.ShardDisconnect,
  async execute(closeEvent, shardId, client) {
    // wtf does this do?
  },
};
