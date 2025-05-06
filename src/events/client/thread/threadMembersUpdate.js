const { Events } = require("discord.js");

module.exports = {
  name: Events.ThreadMembersUpdate,
  async execute(addedMembers, removedMembers, thread, client) {},
};
