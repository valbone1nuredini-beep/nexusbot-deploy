// bot/commands/moderation/userinfo.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('userinfo')
  .setDescription('Get detailed info about a user')
  .addUserOption(o => o.setName('user').setDescription('User to look up (defaults to you)').setRequired(false));

export async function execute(interaction) {
  const target = interaction.options.getMember('user') ?? interaction.member;
  const user   = target.user;

  const roles = target.roles.cache
    .filter(r => r.id !== interaction.guild.roles.everyone.id)
    .sort((a, b) => b.position - a.position)
    .map(r => `<@&${r.id}>`)
    .slice(0, 10)
    .join(' ') || 'None';

  const flags = user.flags?.toArray().map(f => f.replace(/_/g, ' ')).join(', ') || 'None';

  const embed = new EmbedBuilder()
    .setColor(target.displayHexColor === '#000000' ? '#5865F2' : target.displayHexColor)
    .setTitle(`${user.tag}`)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: '🆔 User ID',        value: user.id,                                                    inline: true },
      { name: '🤖 Bot',            value: user.bot ? 'Yes' : 'No',                                    inline: true },
      { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`,        inline: true },
      { name: '📥 Joined Server',   value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:D>`,       inline: true },
      { name: '🎨 Display Color',   value: target.displayHexColor,                                    inline: true },
      { name: '⚡ Highest Role',    value: `${target.roles.highest}`,                                 inline: true },
      { name: `🏷️ Roles (${target.roles.cache.size - 1})`, value: roles },
      { name: '🏅 Badges',          value: flags },
    )
    .setFooter({ text: `Requested by ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
