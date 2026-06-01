// bot/commands/welcome/welcome.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from 'discord.js';

// In-memory config (replace with DB for persistence)
export const welcomeConfig = new Map(); // guildId -> { channelId, message, roleId, embedColor }

export const data = new SlashCommandBuilder()
  .setName('welcome')
  .setDescription('Configure welcome messages')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub => sub
    .setName('set')
    .setDescription('Set the welcome channel and message')
    .addChannelOption(o => o.setName('channel').setDescription('Welcome channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Welcome message. Use {user}, {server}, {count}').setRequired(false)))
  .addSubcommand(sub => sub
    .setName('role')
    .setDescription('Auto-assign a role when a member joins')
    .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('test')
    .setDescription('Preview the welcome message'))
  .addSubcommand(sub => sub
    .setName('disable')
    .setDescription('Disable welcome messages'));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const cfg = welcomeConfig.get(interaction.guild.id) ?? {};

  if (sub === 'set') {
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message') ?? 'Welcome to **{server}**, {user}! You are member #{count} 🎉';
    welcomeConfig.set(interaction.guild.id, { ...cfg, channelId: channel.id, message, enabled: true });
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00FF88).setDescription(`✅ Welcome messages set in ${channel}`)], ephemeral: true });

  } else if (sub === 'role') {
    const role = interaction.options.getRole('role');
    welcomeConfig.set(interaction.guild.id, { ...cfg, roleId: role.id });
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00FF88).setDescription(`✅ Auto-role set to ${role}`)], ephemeral: true });

  } else if (sub === 'test') {
    if (!cfg.channelId) return interaction.reply({ content: '❌ No welcome channel set. Use `/welcome set` first.', ephemeral: true });
    const channel = interaction.guild.channels.cache.get(cfg.channelId);
    const msg = (cfg.message ?? 'Welcome to **{server}**, {user}! You are member #{count} 🎉')
      .replace('{user}', interaction.user.toString())
      .replace('{server}', interaction.guild.name)
      .replace('{count}', interaction.guild.memberCount);
    const embed = new EmbedBuilder().setColor(0x5865F2).setDescription(msg).setFooter({ text: '👆 This is a preview' });
    await channel.send({ embeds: [embed] });
    await interaction.reply({ content: `✅ Preview sent to ${channel}`, ephemeral: true });

  } else if (sub === 'disable') {
    welcomeConfig.set(interaction.guild.id, { ...cfg, enabled: false });
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription('✅ Welcome messages disabled')], ephemeral: true });
  }
}
