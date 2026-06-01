// bot/commands/moderation/kick.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a member from the server')
  .addUserOption(o => o.setName('user').setDescription('The user to kick').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Reason for the kick').setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);

export async function execute(interaction) {
  const target = interaction.options.getMember('user');
  const reason = interaction.options.getString('reason') ?? 'No reason provided';

  if (!target) return interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
  if (!target.kickable) return interaction.reply({ content: '❌ I cannot kick this user.', ephemeral: true });
  if (target.id === interaction.user.id) return interaction.reply({ content: '❌ You cannot kick yourself.', ephemeral: true });

  try {
    await target.send(`You have been **kicked** from **${interaction.guild.name}**.\nReason: ${reason}`).catch(() => {});
    await target.kick(reason);

    const embed = new EmbedBuilder()
      .setColor(0xFF6600)
      .setTitle('👢 Member Kicked')
      .addFields(
        { name: 'User', value: `${target.user.tag} (${target.id})`, inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true },
        { name: 'Reason', value: reason },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    await interaction.reply({ content: `❌ Failed to kick: ${err.message}`, ephemeral: true });
  }
}
