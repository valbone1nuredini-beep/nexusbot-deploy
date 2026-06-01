// bot/commands/moderation/mute.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return val * multipliers[unit];
}

export const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('Timeout (mute) a member')
  .addUserOption(o => o.setName('user').setDescription('The user to mute').setRequired(true))
  .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 10m, 1h, 1d (max 28d)').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Reason for the mute').setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction) {
  const target   = interaction.options.getMember('user');
  const durStr   = interaction.options.getString('duration');
  const reason   = interaction.options.getString('reason') ?? 'No reason provided';

  if (!target) return interaction.reply({ content: '❌ User not found.', ephemeral: true });
  if (!target.moderatable) return interaction.reply({ content: '❌ I cannot mute this user.', ephemeral: true });

  const ms = parseDuration(durStr);
  if (!ms) return interaction.reply({ content: '❌ Invalid duration. Use format: `10m`, `1h`, `2d`', ephemeral: true });
  if (ms > 28 * 86400000) return interaction.reply({ content: '❌ Max timeout is 28 days.', ephemeral: true });

  try {
    await target.timeout(ms, reason);

    const embed = new EmbedBuilder()
      .setColor(0xFFAA00)
      .setTitle('🔇 Member Muted')
      .addFields(
        { name: 'User', value: `${target.user.tag}`, inline: true },
        { name: 'Duration', value: durStr, inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true },
        { name: 'Reason', value: reason },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    await interaction.reply({ content: `❌ Failed to mute: ${err.message}`, ephemeral: true });
  }
}
