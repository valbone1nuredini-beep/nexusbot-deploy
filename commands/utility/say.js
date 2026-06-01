// commands/utility/say.js
// /say — send a message as the bot, optionally impersonating a user via webhook
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('say')
  .setDescription('Send a message as the bot or as another user')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption(o =>
    o.setName('message').setDescription('What to say').setRequired(true).setMaxLength(2000))
  .addUserOption(o =>
    o.setName('as').setDescription('Impersonate this user (sends via webhook with their name/avatar)').setRequired(false))
  .addChannelOption(o =>
    o.setName('channel').setDescription('Channel to send in (default: current)').setRequired(false)
      .addChannelTypes(ChannelType.GuildText))
  .addBooleanOption(o =>
    o.setName('embed').setDescription('Send as an embed? (default: false)').setRequired(false));

export async function execute(interaction) {
  const message  = interaction.options.getString('message');
  const asUser   = interaction.options.getUser('as');
  const channel  = interaction.options.getChannel('channel') ?? interaction.channel;
  const useEmbed = interaction.options.getBoolean('embed') ?? false;

  await interaction.deferReply({ ephemeral: true });

  try {
    if (asUser) {
      // Use a webhook to impersonate the user
      const webhooks = await channel.fetchWebhooks();
      let webhook = webhooks.find(w => w.owner?.id === interaction.client.user.id);

      if (!webhook) {
        webhook = await channel.createWebhook({
          name: 'NexusBot Say',
          avatar: interaction.client.user.displayAvatarURL(),
        });
      }

      const member = await interaction.guild.members.fetch(asUser.id).catch(() => null);
      await webhook.send({
        content: useEmbed ? undefined : message,
        embeds: useEmbed ? [new EmbedBuilder().setDescription(message).setColor(0x5865F2)] : [],
        username: member?.displayName ?? asUser.username,
        avatarURL: asUser.displayAvatarURL({ dynamic: true }),
      });

      await interaction.editReply({ content: `✅ Sent as **${asUser.username}** in ${channel}.` });
    } else {
      // Send as the bot directly
      if (useEmbed) {
        await channel.send({
          embeds: [new EmbedBuilder().setDescription(message).setColor(0x5865F2)],
        });
      } else {
        await channel.send({ content: message });
      }
      await interaction.editReply({ content: `✅ Message sent in ${channel}.` });
    }
  } catch (err) {
    console.error('[say]', err);
    await interaction.editReply({ content: `❌ Failed to send: ${err.message}` });
  }
}
