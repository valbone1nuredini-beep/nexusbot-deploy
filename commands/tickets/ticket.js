// bot/commands/tickets/ticket.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';

export const ticketConfig = new Map();  // guildId -> { categoryId, staffRoleId, logChannelId }
export const openTickets  = new Map();  // channelId -> { userId, guildId, claimedBy }

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('🎫 Manage the ticket system (Premium)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub => sub
    .setName('setup')
    .setDescription('Set up the ticket panel')
    .addChannelOption(o => o.setName('channel').setDescription('Channel to send the ticket panel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addRoleOption(o => o.setName('staff_role').setDescription('Role that can see tickets').setRequired(false))
    .addStringOption(o => o.setName('category').setDescription('Category name for ticket channels').setRequired(false)))
  .addSubcommand(sub => sub
    .setName('close')
    .setDescription('Close the current ticket')
    .addStringOption(o => o.setName('reason').setDescription('Reason for closing').setRequired(false)))
  .addSubcommand(sub => sub
    .setName('add')
    .setDescription('Add a user to the current ticket')
    .addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('remove')
    .setDescription('Remove a user from the current ticket')
    .addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('claim')
    .setDescription('Claim this ticket as a staff member'))
  .addSubcommand(sub => sub
    .setName('rename')
    .setDescription('Rename the ticket channel')
    .addStringOption(o => o.setName('name').setDescription('New channel name').setRequired(true)));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'setup') {
    const channel   = interaction.options.getChannel('channel');
    const staffRole = interaction.options.getRole('staff_role');
    const category  = interaction.options.getString('category') ?? 'Tickets';

    ticketConfig.set(interaction.guild.id, {
      panelChannelId: channel.id,
      staffRoleId: staffRole?.id,
      category,
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎫 Support Tickets')
      .setDescription('Need help? Click the button below to open a ticket.\nOur staff team will assist you as soon as possible.')
      .setFooter({ text: interaction.guild.name });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_open')
        .setLabel('Open a Ticket')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Primary),
    );

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ Ticket panel sent to ${channel}`, ephemeral: true });

  } else if (sub === 'close') {
    const ticket = openTickets.get(interaction.channel.id);
    if (!ticket) return interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });

    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    await interaction.reply({ content: `🔒 Closing ticket in 5 seconds...\nReason: ${reason}` });
    setTimeout(async () => {
      openTickets.delete(interaction.channel.id);
      await interaction.channel.delete().catch(() => {});
    }, 5000);

  } else if (sub === 'add') {
    const user = interaction.options.getMember('user');
    if (!openTickets.has(interaction.channel.id)) return interaction.reply({ content: '❌ Not a ticket channel.', ephemeral: true });
    await interaction.channel.permissionOverwrites.edit(user, { ViewChannel: true, SendMessages: true });
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00FF88).setDescription(`✅ Added ${user} to the ticket.`)] });

  } else if (sub === 'remove') {
    const user = interaction.options.getMember('user');
    if (!openTickets.has(interaction.channel.id)) return interaction.reply({ content: '❌ Not a ticket channel.', ephemeral: true });
    await interaction.channel.permissionOverwrites.edit(user, { ViewChannel: false });
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`✅ Removed ${user} from the ticket.`)] });

  } else if (sub === 'claim') {
    const ticket = openTickets.get(interaction.channel.id);
    if (!ticket) return interaction.reply({ content: '❌ Not a ticket channel.', ephemeral: true });
    ticket.claimedBy = interaction.user.id;
    await interaction.channel.setName(`claimed-${interaction.channel.name.replace(/^ticket-/, '')}`);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00FF88).setDescription(`✅ Ticket claimed by ${interaction.user}`)] });

  } else if (sub === 'rename') {
    if (!openTickets.has(interaction.channel.id)) return interaction.reply({ content: '❌ Not a ticket channel.', ephemeral: true });
    const name = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '-');
    await interaction.channel.setName(name);
    await interaction.reply({ content: `✅ Renamed to \`${name}\``, ephemeral: true });
  }
}

// Handle button interactions for opening tickets
export async function handleButton(interaction) {
  if (interaction.customId !== 'ticket_open') return;

  const cfg = ticketConfig.get(interaction.guild.id);
  const existing = [...openTickets.values()].find(t => t.userId === interaction.user.id && t.guildId === interaction.guild.id);

  if (existing) {
    return interaction.reply({ content: '❌ You already have an open ticket!', ephemeral: true });
  }

  try {
    const ticketChannel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ...(cfg?.staffRoleId ? [{ id: cfg.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
      ],
    });

    openTickets.set(ticketChannel.id, { userId: interaction.user.id, guildId: interaction.guild.id });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎫 Ticket Opened')
      .setDescription(`Hello ${interaction.user}! A staff member will be with you shortly.\n\nDescribe your issue and we'll help you as soon as possible.`)
      .setFooter({ text: 'Use /ticket close to close this ticket' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_close_btn').setLabel('Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    );

    await ticketChannel.send({ content: `${interaction.user}`, embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ Ticket created: ${ticketChannel}`, ephemeral: true });
  } catch (err) {
    await interaction.reply({ content: `❌ Failed to create ticket: ${err.message}`, ephemeral: true });
  }
}
