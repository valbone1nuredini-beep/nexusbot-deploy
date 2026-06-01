// bot/commands/moderation/serverinfo.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('Get detailed info about this server');

export async function execute(interaction) {
  const guild = interaction.guild;
  await guild.fetch();

  const owner       = await guild.fetchOwner();
  const channels    = guild.channels.cache;
  const textCount   = channels.filter(c => c.type === 0).size;
  const voiceCount  = channels.filter(c => c.type === 2).size;
  const catCount    = channels.filter(c => c.type === 4).size;
  const memberCount = guild.memberCount;
  const botCount    = guild.members.cache.filter(m => m.user.bot).size;
  const humanCount  = memberCount - botCount;
  const roleCount   = guild.roles.cache.size - 1; // exclude @everyone
  const emojiCount  = guild.emojis.cache.size;
  const boostLevel  = guild.premiumTier;
  const boostCount  = guild.premiumSubscriptionCount ?? 0;

  const verificationLevels = ['None', 'Low', 'Medium', 'High', 'Very High'];
  const boostTiers = ['No Tier', 'Tier 1', 'Tier 2', 'Tier 3'];

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(guild.name)
    .setThumbnail(guild.iconURL({ size: 256 }))
    .addFields(
      { name: '🆔 Server ID',       value: guild.id,                                                inline: true },
      { name: '👑 Owner',           value: `${owner.user.tag}`,                                     inline: true },
      { name: '📅 Created',         value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`,    inline: true },
      { name: '👥 Members',         value: `${memberCount} total (${humanCount} humans, ${botCount} bots)`, inline: false },
      { name: '💬 Channels',        value: `${textCount} text · ${voiceCount} voice · ${catCount} categories`, inline: false },
      { name: '🏷️ Roles',           value: `${roleCount}`,                                          inline: true },
      { name: '😀 Emojis',          value: `${emojiCount}`,                                         inline: true },
      { name: '🔒 Verification',    value: verificationLevels[guild.verificationLevel] ?? 'Unknown', inline: true },
      { name: '🚀 Boost Level',     value: boostTiers[boostLevel] ?? 'No Tier',                     inline: true },
      { name: '💎 Boosts',          value: `${boostCount}`,                                         inline: true },
    )
    .setFooter({ text: `Requested by ${interaction.user.tag}` })
    .setTimestamp();

  if (guild.bannerURL()) embed.setImage(guild.bannerURL({ size: 1024 }));

  await interaction.reply({ embeds: [embed] });
}
