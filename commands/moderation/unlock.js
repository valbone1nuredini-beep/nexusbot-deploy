// bot/commands/moderation/unlock.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('unlock')
  .setDescription('Unlock a previously locked channel')
  .addChannelOption(o => o.setName('channel').setDescription('Channel to unlock (defaults to current)').setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction) {
  const channel = interaction.options.getChannel('channel') ?? interaction.channel;

  try {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
    const embed = new EmbedBuilder()
      .setColor(0x00FF88)
      .setTitle('🔓 Channel Unlocked')
      .setDescription(`${channel} has been unlocked.`)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    await interaction.reply({ content: `❌ Failed: ${err.message}`, ephemeral: true });
  }
}
