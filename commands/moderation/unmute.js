// bot/commands/moderation/unmute.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('unmute')
  .setDescription('Remove timeout from a member')
  .addUserOption(o => o.setName('user').setDescription('The user to unmute').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction) {
  const target = interaction.options.getMember('user');
  if (!target) return interaction.reply({ content: '❌ User not found.', ephemeral: true });
  if (!target.isCommunicationDisabled()) return interaction.reply({ content: '❌ This user is not muted.', ephemeral: true });

  try {
    await target.timeout(null);
    const embed = new EmbedBuilder()
      .setColor(0x00FF88)
      .setTitle('🔊 Member Unmuted')
      .addFields(
        { name: 'User', value: target.user.tag, inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    await interaction.reply({ content: `❌ Failed to unmute: ${err.message}`, ephemeral: true });
  }
}
