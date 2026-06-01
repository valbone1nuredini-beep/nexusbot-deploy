// commands/utility/rules.js
// /rules — set up a rules panel with numbered rules and an accept button
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

// Store per-guild rules config: { rules: string[], channelId, roleId, color, title, footer }
export const rulesConfig = new Map();

export const data = new SlashCommandBuilder()
  .setName('rules')
  .setDescription('Set up and manage the server rules panel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub => sub
    .setName('setup')
    .setDescription('Post the rules panel in a channel')
    .addChannelOption(o => o.setName('channel').setDescription('Channel to post rules in').setRequired(true)
      .addChannelTypes(ChannelType.GuildText))
    .addRoleOption(o => o.setName('role').setDescription('Role to give when user accepts rules').setRequired(false))
    .addStringOption(o => o.setName('title').setDescription('Rules embed title').setRequired(false))
    .addStringOption(o => o.setName('color').setDescription('Embed color hex e.g. FF0000').setRequired(false))
    .addStringOption(o => o.setName('footer').setDescription('Footer text').setRequired(false)))
  .addSubcommand(sub => sub
    .setName('add')
    .setDescription('Add a rule')
    .addStringOption(o => o.setName('rule').setDescription('Rule text').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('remove')
    .setDescription('Remove a rule by number')
    .addIntegerOption(o => o.setName('number').setDescription('Rule number to remove').setRequired(true).setMinValue(1)))
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('Preview the current rules'))
  .addSubcommand(sub => sub
    .setName('clear')
    .setDescription('Clear all rules'));

export async function execute(interaction) {
  const sub     = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const cfg     = rulesConfig.get(guildId) ?? { rules: [], title: '📜 Server Rules', color: 'FF0000', footer: '', roleId: null, channelId: null };

  if (sub === 'add') {
    const rule = interaction.options.getString('rule');
    if (cfg.rules.length >= 25) return interaction.reply({ content: '❌ Maximum 25 rules.', ephemeral: true });
    cfg.rules.push(rule);
    rulesConfig.set(guildId, cfg);
    await interaction.reply({ content: `✅ Rule **#${cfg.rules.length}** added: ${rule}`, ephemeral: true });

  } else if (sub === 'remove') {
    const num = interaction.options.getInteger('number');
    if (num > cfg.rules.length) return interaction.reply({ content: `❌ Rule #${num} doesn't exist.`, ephemeral: true });
    const removed = cfg.rules.splice(num - 1, 1)[0];
    rulesConfig.set(guildId, cfg);
    await interaction.reply({ content: `✅ Removed rule #${num}: ${removed}`, ephemeral: true });

  } else if (sub === 'list') {
    if (cfg.rules.length === 0) return interaction.reply({ content: '📭 No rules added yet. Use `/rules add` first.', ephemeral: true });
    const embed = buildRulesEmbed(cfg, interaction.guild);
    await interaction.reply({ embeds: [embed], ephemeral: true });

  } else if (sub === 'clear') {
    cfg.rules = [];
    rulesConfig.set(guildId, cfg);
    await interaction.reply({ content: '✅ All rules cleared.', ephemeral: true });

  } else if (sub === 'setup') {
    const channel = interaction.options.getChannel('channel');
    const role    = interaction.options.getRole('role');
    const title   = interaction.options.getString('title') ?? '📜 Server Rules';
    const color   = interaction.options.getString('color')?.replace('#', '') ?? 'FF0000';
    const footer  = interaction.options.getString('footer') ?? `${interaction.guild.name} — Please follow these rules`;

    cfg.channelId = channel.id;
    cfg.roleId    = role?.id ?? null;
    cfg.title     = title;
    cfg.color     = color;
    cfg.footer    = footer;
    rulesConfig.set(guildId, cfg);

    if (cfg.rules.length === 0) {
      return interaction.reply({ content: '⚠️ Add some rules first with `/rules add`, then run `/rules setup` again.', ephemeral: true });
    }

    const embed = buildRulesEmbed(cfg, interaction.guild);
    const components = [];

    if (role) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`rules_accept_${guildId}`)
          .setLabel('✅ I Accept the Rules')
          .setStyle(ButtonStyle.Success),
      );
      components.push(row);
    }

    await channel.send({ embeds: [embed], components });
    await interaction.reply({ content: `✅ Rules panel posted in ${channel}${role ? ` — users will get ${role} on accept` : ''}.`, ephemeral: true });
  }
}

function buildRulesEmbed(cfg, guild) {
  let color;
  try { color = parseInt(cfg.color, 16); } catch { color = 0xFF0000; }

  const desc = cfg.rules.length > 0
    ? cfg.rules.map((r, i) => `**${i + 1}.** ${r}`).join('\n\n')
    : '*No rules added yet.*';

  return new EmbedBuilder()
    .setTitle(cfg.title)
    .setDescription(desc)
    .setColor(color)
    .setFooter({ text: cfg.footer || guild.name })
    .setTimestamp();
}

// Handle the accept button (called from interactionCreate in index.js)
export async function handleRulesAccept(interaction) {
  const guildId = interaction.guild.id;
  const cfg     = rulesConfig.get(guildId);
  if (!cfg?.roleId) return interaction.reply({ content: '✅ Rules acknowledged!', ephemeral: true });

  const member = interaction.member;
  if (member.roles.cache.has(cfg.roleId)) {
    return interaction.reply({ content: '✅ You already accepted the rules!', ephemeral: true });
  }

  await member.roles.add(cfg.roleId).catch(() => {});
  await interaction.reply({ content: `✅ Thanks for accepting the rules! You've been given the <@&${cfg.roleId}> role.`, ephemeral: true });
}
