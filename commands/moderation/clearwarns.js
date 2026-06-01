// bot/commands/moderation/clearwarns.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { warnings } from './warn.js';

export const data = new SlashCommandBuilder()
  .setName('clearwarns')
  .setDescription('Clear all warnings for a user')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(o => o.setName('user').setDescription('The user to clear warnings for').setRequired(true));

export async function execute(interaction) {
  const target     = interaction.options.getUser('user');
  const guildWarns = warnings.get(interaction.guild.id);
  const userWarns  = guildWarns?.get(target.id) ?? [];

  if (userWarns.length === 0) {
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xFFCC00)
        .setDescription(`⚠️ ${target.tag} has no warnings to clear.`)],
      ephemeral: true,
    });
  }

  const count = userWarns.length;
  guildWarns.set(target.id, []);

  const embed = new EmbedBuilder()
    .setColor(0x00FF88)
    .setTitle('🧹 Warnings Cleared')
    .addFields(
      { name: 'User', value: target.tag, inline: true },
      { name: 'Cleared by', value: interaction.user.tag, inline: true },
      { name: 'Warnings removed', value: `${count}`, inline: true },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  try {
    await target.send(`✅ Your **${count}** warning(s) in **${interaction.guild.name}** have been cleared by a moderator.`);
  } catch {}
}
