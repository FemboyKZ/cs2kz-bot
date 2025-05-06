const { Events } = require("discord.js");

module.exports = {
  name: Events.GuildAuditLogEntryCreate,
  async execute(auditLogEntry, guild, client) {
    // wtf does this do?
  },
};
