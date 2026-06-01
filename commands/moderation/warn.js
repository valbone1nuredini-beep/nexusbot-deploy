// bot/commands/moderation/warn.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

// In-memory store (replace with DB for persistence)
const warnings = new Map(); // guildId -> Map(userId -> [{reason, mod, date}])

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Issue a warning to a member')
  .addUserOption(o => o.setName('user').setDescription('The user to warn').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Reason for the warning').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction) {
  const target = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');

  if (!warnings.has(interaction.guild.id)) warnings.set(interaction.guild.id, new Map());
  const guildWarns = warnings.get(interaction.guild.id);
  if (!guildWarns.has(target.id)) guildWarns.set(target.id, []);

  const userWarns = guildWarns.get(target.id);
  userWarns.push({ reason, mod: interaction.user.tag, date: new Date().toISOString() });

  const embed = new EmbedBuilder()
    .setColor(0xFFCC00)
    .setTitle('⚠️ Member Warned')
    .addFields(
      { name: 'User', value: `${target.tag}`, inline: true },
      { name: 'Moderator', value: interaction.user.tag, inline: true },
      { name: 'Total Warnings', value: `${userWarns.length}`, inline: true },
      { name: 'Reason', value: reason },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  try {
    await target.send(`⚠️ You have been **warned** in **${interaction.guild.name}**.\nReason: ${reason}\nTotal warnings: ${userWarns.length}`);
  } catch {}
}

export { warnings };
