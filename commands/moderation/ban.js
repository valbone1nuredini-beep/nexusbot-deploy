// bot/commands/moderation/ban.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a member from the server')
  .addUserOption(o => o.setName('user').setDescription('The user to ban').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Reason for the ban').setRequired(false))
  .addIntegerOption(o => o.setName('days').setDescription('Days of messages to delete (0-7)').setMinValue(0).setMaxValue(7).setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction) {
  const target = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const days   = interaction.options.getInteger('days') ?? 0;

  const member = interaction.guild.members.cache.get(target.id);

  if (member) {
    if (!member.bannable) {
      return interaction.reply({ content: '❌ I cannot ban this user — they may have a higher role than me.', ephemeral: true });
    }
    if (member.id === interaction.user.id) {
      return interaction.reply({ content: '❌ You cannot ban yourself.', ephemeral: true });
    }
  }

  try {
    await interaction.guild.members.ban(target, { reason, deleteMessageSeconds: days * 86400 });

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🔨 Member Banned')
      .addFields(
        { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true },
        { name: 'Reason', value: reason },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // DM the banned user
    try {
      await target.send(`You have been **banned** from **${interaction.guild.name}**.\nReason: ${reason}`);
    } catch {}
  } catch (err) {
    await interaction.reply({ content: `❌ Failed to ban: ${err.message}`, ephemeral: true });
  }
}
