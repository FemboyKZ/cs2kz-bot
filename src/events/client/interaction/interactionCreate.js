const {
  PermissionsBitField,
  EmbedBuilder,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (!interaction || !client) {
      return;
    }

    /*
    const { cooldowns } = interaction.client;
    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const defaultCooldownDuration = 3;
    const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1000;

    if (timestamps.has(interaction.user.id)) {
      const expirationTime =
        timestamps.get(interaction.user.id) + cooldownAmount;

      if (now < expirationTime) {
        const expiredTimestamp = Math.round(expirationTime / 1000);
        return interaction.reply({
          content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`,
          ephemeral: true,
        });
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
    */

    /*
    if (interaction.isAnySelectMenu()) {
    }

    if (interaction.isAutoComplete()) {
    }

    if (interaction.isButton()) {
    }

    if (interaction.isChannelSelectMenu()) {
    }

    if (interaction.isChatInputCommand()) {
    }
    */

    if (interaction.isCommand()) {
      const command = await client.commands.get(interaction.commandName);
      if (!command) {
        return;
      }

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error("Error executing command:", error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: "There was an error while executing this command!",
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: "There was an error while executing this command!",
            ephemeral: true,
          });
        }
      }
    }

    /*
    if (interaction.isContextMenuCommand()) {
    }

    if (interaction.isFromMessage()) {
    }

    if (interaction.isMentionableSelectMenu()) {
    }
    
    if (interaction.isMessageComponent()) {
    }

    if (interaction.isMessageContextMenuCommand()) {
    }

    if (interaction.isModalSubmit()) {
    }

    if (interaction.isRepliable()) {
    }

    if (interaction.isRoleSelectMenu()) {
    }

    if (interaction.isStringSelectMenu()) {
    }

    if (interaction.isUserContextMenuCommand()) {
    }

    if (interaction.isUserSelectMenu()) {
    }
    */
  },
};
