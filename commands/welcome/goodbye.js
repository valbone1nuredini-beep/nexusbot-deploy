// bot/commands/welcome/goodbye.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from 'discord.js';

export const goodbyeConfig = new Map(); // guildId -> { channelId, message, enabled }

export const data = new SlashCommandBuilder()
  .setName('goodbye')
  .setDescription('Configure goodbye messages')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub => sub
    .setName('set')
    .setDescription('Set the goodbye channel and message')
    .addChannelOption(o => o.setName('channel').setDescription('Goodbye channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Goodbye message. Use {user}, {server}').setRequired(false)))
  .addSubcommand(sub => sub
    .setName('test')
    .setDescription('Preview the goodbye message'))
  .addSubcommand(sub => sub
    .setName('disable')
    .setDescription('Disable goodbye messages'));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const cfg = goodbyeConfig.get(interaction.guild.id) ?? {};

  if (sub === 'set') {
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message') ?? 'Goodbye **{user}**, we hope to see you again in **{server}**!';
    goodbyeConfig.set(interaction.guild.id, { ...cfg, channelId: channel.id, message, enabled: true });
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00FF88).setDescription(`✅ Goodbye messages set in ${channel}`)], ephemeral: true });

  } else if (sub === 'test') {
    if (!cfg.channelId) return interaction.reply({ content: '❌ No goodbye channel set. Use `/goodbye set` first.', ephemeral: true });
    const channel = interaction.guild.channels.cache.get(cfg.channelId);
    const msg = (cfg.message ?? 'Goodbye **{user}**!')
      .replace('{user}', interaction.user.tag)
      .replace('{server}', interaction.guild.name);
    const embed = new EmbedBuilder().setColor(0xFF6600).setDescription(msg).setFooter({ text: '👆 This is a preview' });
    await channel.send({ embeds: [embed] });
    await interaction.reply({ content: `✅ Preview sent to ${channel}`, ephemeral: true });

  } else if (sub === 'disable') {
    goodbyeConfig.set(interaction.guild.id, { ...cfg, enabled: false });
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription('✅ Goodbye messages disabled')], ephemeral: true });
  }
}
