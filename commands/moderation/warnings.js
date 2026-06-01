// bot/commands/moderation/warnings.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { warnings } from './warn.js';

export const data = new SlashCommandBuilder()
  .setName('warnings')
  .setDescription('View all warnings for a user')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(o => o.setName('user').setDescription('The user to check warnings for').setRequired(true));

export async function execute(interaction) {
  const target     = interaction.options.getUser('user');
  const guildWarns = warnings.get(interaction.guild.id);
  const userWarns  = guildWarns?.get(target.id) ?? [];

  if (userWarns.length === 0) {
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x00FF88)
        .setDescription(`✅ ${target.tag} has no warnings.`)],
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0xFFCC00)
    .setTitle(`⚠️ Warnings for ${target.tag}`)
    .setDescription(`**${userWarns.length}** warning(s) total`)
    .setThumbnail(target.displayAvatarURL())
    .setTimestamp();

  userWarns.forEach((w, i) => {
    embed.addFields({
      name: `Warning #${i + 1} — ${new Date(w.date).toLocaleDateString()}`,
      value: `**Reason:** ${w.reason}\n**Moderator:** ${w.mod}`,
    });
  });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
