// commands/utility/verify.js
// /verify — gives a user a verified role and logs it
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} from 'discord.js';

// Store per-guild verify config: { roleId, channelId, message, logChannelId }
export const verifyConfig = new Map();

export const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('Verification system setup and management')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub => sub
    .setName('setup')
    .setDescription('Set up the verification system')
    .addRoleOption(o => o.setName('role').setDescription('Role to give on verification').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Channel to post the verify button').setRequired(true)
      .addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName('message').setDescription('Custom message above the button').setRequired(false))
    .addChannelOption(o => o.setName('log').setDescription('Channel to log verifications').setRequired(false)
      .addChannelTypes(ChannelType.GuildText)))
  .addSubcommand(sub => sub
    .setName('user')
    .setDescription('Manually verify a user')
    .addUserOption(o => o.setName('user').setDescription('User to verify').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('unverify')
    .setDescription('Remove verification from a user')
    .addUserOption(o => o.setName('user').setDescription('User to unverify').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('config')
    .setDescription('View current verification config'));

export async function execute(interaction) {
  const sub     = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const cfg     = verifyConfig.get(guildId) ?? {};

  if (sub === 'setup') {
    const role       = interaction.options.getRole('role');
    const channel    = interaction.options.getChannel('channel');
    const message    = interaction.options.getString('message') ?? '✅ Click the button below to verify yourself and gain access to the server.';
    const logChannel = interaction.options.getChannel('log');

    verifyConfig.set(guildId, {
      roleId: role.id,
      channelId: channel.id,
      message,
      logChannelId: logChannel?.id ?? null,
    });

    // Post the verify panel
    const embed = new EmbedBuilder()
      .setColor(0x00FF88)
      .setTitle('🔐 Verification')
      .setDescription(message)
      .setFooter({ text: interaction.guild.name });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`verify_btn_${guildId}`)
        .setLabel('Verify Me')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
    );

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ Verification panel posted in ${channel}. Role: ${role}`, ephemeral: true });

  } else if (sub === 'user') {
    if (!cfg.roleId) return interaction.reply({ content: '❌ Run `/verify setup` first.', ephemeral: true });
    const user   = interaction.options.getUser('user');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });

    await member.roles.add(cfg.roleId).catch(() => {});
    await interaction.reply({ content: `✅ Verified ${user}.`, ephemeral: true });
    await logVerify(interaction.guild, cfg, user, interaction.user, 'Manual verify');

  } else if (sub === 'unverify') {
    if (!cfg.roleId) return interaction.reply({ content: '❌ Run `/verify setup` first.', ephemeral: true });
    const user   = interaction.options.getUser('user');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });

    await member.roles.remove(cfg.roleId).catch(() => {});
    await interaction.reply({ content: `✅ Unverified ${user}.`, ephemeral: true });

  } else if (sub === 'config') {
    if (!cfg.roleId) return interaction.reply({ content: '📭 No verification config set. Use `/verify setup`.', ephemeral: true });
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🔐 Verify Config')
      .addFields(
        { name: 'Role', value: `<@&${cfg.roleId}>`, inline: true },
        { name: 'Channel', value: `<#${cfg.channelId}>`, inline: true },
        { name: 'Log Channel', value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : 'None', inline: true },
        { name: 'Message', value: cfg.message },
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

// Handle the verify button click (called from interactionCreate in index.js)
export async function handleVerifyButton(interaction) {
  const guildId = interaction.guild.id;
  const cfg     = verifyConfig.get(guildId);
  if (!cfg) return interaction.reply({ content: '❌ Verification not configured.', ephemeral: true });

  const member = interaction.member;
  if (member.roles.cache.has(cfg.roleId)) {
    return interaction.reply({ content: '✅ You are already verified!', ephemeral: true });
  }

  await member.roles.add(cfg.roleId).catch(() => {});
  await interaction.reply({ content: '✅ You have been verified! Welcome to the server.', ephemeral: true });
  await logVerify(interaction.guild, cfg, interaction.user, null, 'Button click');
}

async function logVerify(guild, cfg, user, moderator, method) {
  if (!cfg.logChannelId) return;
  const logCh = guild.channels.cache.get(cfg.logChannelId);
  if (!logCh) return;
  const embed = new EmbedBuilder()
    .setColor(0x00FF88)
    .setTitle('✅ Member Verified')
    .addFields(
      { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
      { name: 'Method', value: method, inline: true },
      { name: 'By', value: moderator ? moderator.tag : 'Self', inline: true },
    )
    .setTimestamp();
  await logCh.send({ embeds: [embed] }).catch(() => {});
}
