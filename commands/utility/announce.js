// commands/utility/announce.js
// /announce — send a rich announcement embed as the bot
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('announce')
  .setDescription('Send an announcement as the bot')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption(o =>
    o.setName('message').setDescription('Announcement content').setRequired(true).setMaxLength(4000))
  .addChannelOption(o =>
    o.setName('channel').setDescription('Channel to announce in (default: current)').setRequired(false)
      .addChannelTypes(ChannelType.GuildText))
  .addStringOption(o =>
    o.setName('title').setDescription('Embed title').setRequired(false))
  .addStringOption(o =>
    o.setName('color').setDescription('Embed color hex e.g. FF0000 (default: red)').setRequired(false))
  .addStringOption(o =>
    o.setName('ping').setDescription('Role or @everyone to ping').setRequired(false))
  .addStringOption(o =>
    o.setName('image').setDescription('Image URL to attach to the embed').setRequired(false))
  .addBooleanOption(o =>
    o.setName('embed').setDescription('Send as embed? (default: true)').setRequired(false));

export async function execute(interaction) {
  const message  = interaction.options.getString('message');
  const channel  = interaction.options.getChannel('channel') ?? interaction.channel;
  const title    = interaction.options.getString('title') ?? '📢 Announcement';
  const colorHex = interaction.options.getString('color')?.replace('#', '') ?? 'FF0000';
  const ping     = interaction.options.getString('ping');
  const image    = interaction.options.getString('image');
  const useEmbed = interaction.options.getBoolean('embed') ?? true;

  await interaction.deferReply({ ephemeral: true });

  try {
    let color;
    try { color = parseInt(colorHex, 16); } catch { color = 0xFF0000; }

    const pingContent = ping
      ? (ping === '@everyone' || ping === 'everyone' ? '@everyone' : ping.startsWith('<@&') ? ping : `<@&${ping.replace(/\D/g, '')}>`)
      : null;

    if (useEmbed) {
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(message)
        .setColor(color)
        .setFooter({ text: `Announced by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      if (image) embed.setImage(image);

      await channel.send({
        content: pingContent ?? undefined,
        embeds: [embed],
      });
    } else {
      await channel.send({
        content: `${pingContent ? pingContent + '\n' : ''}${message}`,
      });
    }

    await interaction.editReply({ content: `✅ Announcement sent in ${channel}.` });
  } catch (err) {
    console.error('[announce]', err);
    await interaction.editReply({ content: `❌ Failed: ${err.message}` });
  }
}
