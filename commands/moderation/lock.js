// bot/commands/moderation/lock.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('lock')
  .setDescription('Lock a channel so members cannot send messages')
  .addChannelOption(o => o.setName('channel').setDescription('Channel to lock (defaults to current)').setRequired(false))
  .addStringOption(o => o.setName('reason').setDescription('Reason for locking').setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction) {
  const channel = interaction.options.getChannel('channel') ?? interaction.channel;
  const reason  = interaction.options.getString('reason') ?? 'Channel locked by moderator';

  try {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🔒 Channel Locked')
      .setDescription(`${channel} has been locked.\nReason: ${reason}`)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    await interaction.reply({ content: `❌ Failed: ${err.message}`, ephemeral: true });
  }
}
