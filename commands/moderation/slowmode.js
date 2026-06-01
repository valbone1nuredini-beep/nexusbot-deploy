// bot/commands/moderation/slowmode.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('slowmode')
  .setDescription('Set slowmode for a channel')
  .addIntegerOption(o => o.setName('seconds').setDescription('Slowmode in seconds (0 to disable, max 21600)').setMinValue(0).setMaxValue(21600).setRequired(true))
  .addChannelOption(o => o.setName('channel').setDescription('Channel to set slowmode in (defaults to current)').setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction) {
  const seconds = interaction.options.getInteger('seconds');
  const channel = interaction.options.getChannel('channel') ?? interaction.channel;

  try {
    await channel.setRateLimitPerUser(seconds);
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('⏱️ Slowmode Updated')
      .setDescription(seconds === 0 ? `Slowmode disabled in ${channel}` : `Slowmode set to **${seconds}s** in ${channel}`)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    await interaction.reply({ content: `❌ Failed: ${err.message}`, ephemeral: true });
  }
}
