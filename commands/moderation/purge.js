// bot/commands/moderation/purge.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('Delete multiple messages from a channel')
  .addIntegerOption(o => o.setName('amount').setDescription('Number of messages to delete (1-100)').setMinValue(1).setMaxValue(100).setRequired(true))
  .addUserOption(o => o.setName('user').setDescription('Only delete messages from this user').setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  const amount = interaction.options.getInteger('amount');
  const user   = interaction.options.getUser('user');

  await interaction.deferReply({ ephemeral: true });

  try {
    let messages = await interaction.channel.messages.fetch({ limit: 100 });

    if (user) {
      messages = messages.filter(m => m.author.id === user.id).first(amount);
    } else {
      messages = messages.first(amount);
    }

    // Filter out messages older than 14 days (Discord limitation)
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const deletable = messages.filter ? 
      [...messages.values()].filter(m => m.createdTimestamp > twoWeeksAgo) :
      messages.filter(m => m.createdTimestamp > twoWeeksAgo);

    const deleted = await interaction.channel.bulkDelete(deletable, true);

    await interaction.editReply({
      content: `✅ Deleted **${deleted.size}** message(s)${user ? ` from ${user.tag}` : ''}.`,
    });
  } catch (err) {
    await interaction.editReply({ content: `❌ Failed to purge: ${err.message}` });
  }
}
