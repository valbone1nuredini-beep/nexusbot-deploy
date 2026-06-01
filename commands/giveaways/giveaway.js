// bot/commands/giveaways/giveaway.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

// In-memory giveaway store
export const giveaways = new Map(); // messageId -> giveaway data

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return val * multipliers[unit];
}

function formatDuration(ms) {
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`;
  return `${Math.floor(ms / 86400000)}d`;
}

export const data = new SlashCommandBuilder()
  .setName('giveaway')
  .setDescription('🎉 Manage giveaways (Premium)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub => sub
    .setName('start')
    .setDescription('Start a new giveaway')
    .addStringOption(o => o.setName('prize').setDescription('What are you giving away?').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 10m, 1h, 1d').setRequired(true))
    .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(20).setRequired(false)))
  .addSubcommand(sub => sub
    .setName('end')
    .setDescription('End a giveaway early')
    .addStringOption(o => o.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('reroll')
    .setDescription('Reroll winners for a giveaway')
    .addStringOption(o => o.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('List all active giveaways'));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'start') {
    const prize    = interaction.options.getString('prize');
    const durStr   = interaction.options.getString('duration');
    const winners  = interaction.options.getInteger('winners') ?? 1;
    const ms       = parseDuration(durStr);

    if (!ms) return interaction.reply({ content: '❌ Invalid duration. Use: `10m`, `1h`, `2d`', ephemeral: true });

    const endsAt = Date.now() + ms;

    const embed = new EmbedBuilder()
      .setColor(0xFFB60A)
      .setTitle('🎉 GIVEAWAY')
      .setDescription(`**${prize}**\n\nReact with 🎁 to enter!\n\n**Winners:** ${winners}\n**Ends:** <t:${Math.floor(endsAt / 1000)}:R>`)
      .setFooter({ text: `Hosted by ${interaction.user.tag}` })
      .setTimestamp(endsAt);

    await interaction.reply({ content: '🎉 Giveaway started!', ephemeral: true });
    const msg = await interaction.channel.send({ embeds: [embed] });
    await msg.react('🎁');

    giveaways.set(msg.id, {
      messageId: msg.id,
      channelId: interaction.channel.id,
      guildId: interaction.guild.id,
      prize,
      winners,
      endsAt,
      hostId: interaction.user.id,
      ended: false,
    });

    // Auto-end
    setTimeout(async () => {
      await endGiveaway(msg.id, interaction.client);
    }, ms);

  } else if (sub === 'end') {
    const msgId = interaction.options.getString('message_id');
    await interaction.deferReply({ ephemeral: true });
    const result = await endGiveaway(msgId, interaction.client);
    await interaction.editReply({ content: result });

  } else if (sub === 'reroll') {
    const msgId = interaction.options.getString('message_id');
    const gw = giveaways.get(msgId);
    if (!gw) return interaction.reply({ content: '❌ Giveaway not found.', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });
    const result = await pickWinners(msgId, interaction.client, gw.winners);
    await interaction.editReply({ content: result });

  } else if (sub === 'list') {
    const active = [...giveaways.values()].filter(g => !g.ended && g.guildId === interaction.guild.id);
    if (active.length === 0) return interaction.reply({ content: '📭 No active giveaways.', ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor(0xFFB60A)
      .setTitle('🎉 Active Giveaways')
      .setDescription(active.map(g => `**${g.prize}** — ${g.winners} winner(s) — ends <t:${Math.floor(g.endsAt / 1000)}:R>\nMessage ID: \`${g.messageId}\``).join('\n\n'));

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function endGiveaway(msgId, client) {
  const gw = giveaways.get(msgId);
  if (!gw) return '❌ Giveaway not found.';
  if (gw.ended) return '❌ Giveaway already ended.';

  gw.ended = true;
  return await pickWinners(msgId, client, gw.winners);
}

async function pickWinners(msgId, client, count) {
  const gw = giveaways.get(msgId);
  if (!gw) return '❌ Giveaway not found.';

  try {
    const channel = await client.channels.fetch(gw.channelId);
    const message = await channel.messages.fetch(msgId);
    const reaction = message.reactions.cache.get('🎁');
    if (!reaction) return '❌ No reactions found.';

    const users = await reaction.users.fetch();
    const eligible = users.filter(u => !u.bot).map(u => u);

    if (eligible.length === 0) {
      await channel.send('🎉 Giveaway ended — **no valid entries**.');
      return '✅ Giveaway ended with no winners.';
    }

    const shuffled = eligible.sort(() => Math.random() - 0.5);
    const winners = shuffled.slice(0, Math.min(count, shuffled.length));

    const embed = new EmbedBuilder()
      .setColor(0x00FF88)
      .setTitle('🎉 Giveaway Ended!')
      .setDescription(`**Prize:** ${gw.prize}\n**Winner(s):** ${winners.map(w => `<@${w.id}>`).join(', ')}`)
      .setTimestamp();

    await channel.send({ content: winners.map(w => `<@${w.id}>`).join(' '), embeds: [embed] });
    return `✅ Winners: ${winners.map(w => w.tag).join(', ')}`;
  } catch (err) {
    return `❌ Error: ${err.message}`;
  }
}
