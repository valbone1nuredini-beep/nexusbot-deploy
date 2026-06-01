// bot/commands/moderation/embed.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('embed')
  .setDescription('Send a custom embed message to a channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption(o => o.setName('title').setDescription('Title of the embed').setRequired(true))
  .addStringOption(o => o.setName('description').setDescription('Main body text of the embed').setRequired(true))
  .addChannelOption(o => o.setName('channel').setDescription('Channel to send the embed to (defaults to current)').setRequired(false))
  .addStringOption(o => o.setName('color').setDescription('Hex color e.g. FF0000 (default: 5865F2)').setRequired(false))
  .addStringOption(o => o.setName('footer').setDescription('Footer text').setRequired(false))
  .addStringOption(o => o.setName('image').setDescription('Image URL to attach to the embed').setRequired(false))
  .addStringOption(o => o.setName('thumbnail').setDescription('Thumbnail URL (small image top-right)').setRequired(false));

export async function execute(interaction) {
  const title       = interaction.options.getString('title');
  const description = interaction.options.getString('description');
  const channel     = interaction.options.getChannel('channel') ?? interaction.channel;
  const colorInput  = interaction.options.getString('color') ?? '5865F2';
  const footer      = interaction.options.getString('footer');
  const image       = interaction.options.getString('image');
  const thumbnail   = interaction.options.getString('thumbnail');

  // Parse hex color safely
  const colorHex = colorInput.replace('#', '');
  const color = parseInt(colorHex, 16);
  if (isNaN(color)) {
    return interaction.reply({ content: '❌ Invalid color. Use a hex code like `FF0000` or `5865F2`.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description.replace(/\\n/g, '\n'))
    .setColor(color)
    .setTimestamp();

  if (footer)    embed.setFooter({ text: footer });
  if (image)     embed.setImage(image);
  if (thumbnail) embed.setThumbnail(thumbnail);

  try {
    await channel.send({ embeds: [embed] });
    await interaction.reply({ content: `✅ Embed sent to ${channel}!`, ephemeral: true });
  } catch (err) {
    await interaction.reply({ content: `❌ Failed to send embed: ${err.message}`, ephemeral: true });
  }
}
