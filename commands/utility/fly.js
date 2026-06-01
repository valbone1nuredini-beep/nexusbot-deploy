// commands/utility/fly.js
// /fly — move the bot (or a user) to a voice channel
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('fly')
  .setDescription('Bring the bot (or move a user) to a voice channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
  .addSubcommand(sub => sub
    .setName('here')
    .setDescription('Pull the bot into your current voice channel'))
  .addSubcommand(sub => sub
    .setName('to')
    .setDescription('Move the bot to a specific voice channel')
    .addChannelOption(o =>
      o.setName('channel').setDescription('Voice channel to fly to').setRequired(true)
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)))
  .addSubcommand(sub => sub
    .setName('leave')
    .setDescription('Disconnect the bot from voice'))
  .addSubcommand(sub => sub
    .setName('move')
    .setDescription('Move a user to a voice channel')
    .addUserOption(o => o.setName('user').setDescription('User to move').setRequired(true))
    .addChannelOption(o =>
      o.setName('channel').setDescription('Destination voice channel').setRequired(true)
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'here') {
    const voiceChannel = interaction.member.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: '❌ You need to be in a voice channel first!', ephemeral: true });
    }

    try {
      // Join the voice channel using Discord's voice state update
      await interaction.guild.members.me.voice.setChannel(voiceChannel).catch(async () => {
        // Bot isn't in voice yet — use REST to move it
        await interaction.client.rest.patch(
          `/guilds/${interaction.guild.id}/members/@me/voice-state`,
          { body: { channel_id: voiceChannel.id } }
        ).catch(() => {});
      });

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(`✈️ Flying into **${voiceChannel.name}**!`);
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      await interaction.reply({ content: `❌ Couldn't join: ${err.message}`, ephemeral: true });
    }

  } else if (sub === 'to') {
    const channel = interaction.options.getChannel('channel');

    try {
      await interaction.guild.members.me.voice.setChannel(channel).catch(() => {});
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(`✈️ Flying to **${channel.name}**!`);
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      await interaction.reply({ content: `❌ Couldn't move: ${err.message}`, ephemeral: true });
    }

  } else if (sub === 'leave') {
    const botVoice = interaction.guild.members.me.voice?.channel;
    if (!botVoice) {
      return interaction.reply({ content: '❌ I\'m not in a voice channel.', ephemeral: true });
    }

    await interaction.guild.members.me.voice.setChannel(null).catch(() => {});
    await interaction.reply({ content: '👋 Left the voice channel.', ephemeral: true });

  } else if (sub === 'move') {
    const user    = interaction.options.getUser('user');
    const channel = interaction.options.getChannel('channel');
    const member  = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });
    if (!member.voice?.channel) return interaction.reply({ content: `❌ **${user.username}** is not in a voice channel.`, ephemeral: true });

    try {
      await member.voice.setChannel(channel);
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(`✈️ Moved **${user.username}** to **${channel.name}**!`);
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      await interaction.reply({ content: `❌ Couldn't move user: ${err.message}`, ephemeral: true });
    }
  }
}
