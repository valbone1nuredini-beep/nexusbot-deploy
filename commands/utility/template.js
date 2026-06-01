// commands/utility/template.js
// Templates are reusable embed/message blueprints used by /customcommand
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

// Store: guildId -> Map<name, template>
export const templates = new Map();

export const data = new SlashCommandBuilder()
  .setName('template')
  .setDescription('Create and manage message templates for custom commands')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub => sub
    .setName('create')
    .setDescription('Create a new template')
    .addStringOption(o => o.setName('name').setDescription('Template name (used in /customcommand)').setRequired(true))
    .addStringOption(o => o.setName('content').setDescription('Message content. Use {user}, {server}, {channel} as variables').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('Embed title (leave blank for plain message)').setRequired(false))
    .addStringOption(o => o.setName('color').setDescription('Embed color hex e.g. FF0000').setRequired(false))
    .addStringOption(o => o.setName('footer').setDescription('Embed footer text').setRequired(false))
    .addBooleanOption(o => o.setName('embed').setDescription('Send as embed? (default: true)').setRequired(false)))
  .addSubcommand(sub => sub
    .setName('delete')
    .setDescription('Delete a template')
    .addStringOption(o => o.setName('name').setDescription('Template name').setRequired(true).setAutocomplete(true)))
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('List all templates'))
  .addSubcommand(sub => sub
    .setName('preview')
    .setDescription('Preview a template')
    .addStringOption(o => o.setName('name').setDescription('Template name').setRequired(true).setAutocomplete(true)))
  .addSubcommand(sub => sub
    .setName('edit')
    .setDescription('Edit an existing template')
    .addStringOption(o => o.setName('name').setDescription('Template name').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('content').setDescription('New content').setRequired(false))
    .addStringOption(o => o.setName('title').setDescription('New embed title').setRequired(false))
    .addStringOption(o => o.setName('color').setDescription('New embed color hex').setRequired(false))
    .addStringOption(o => o.setName('footer').setDescription('New footer text').setRequired(false)));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const guildTemplates = templates.get(guildId) ?? new Map();

  if (sub === 'create') {
    const name    = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '-');
    const content = interaction.options.getString('content');
    const title   = interaction.options.getString('title');
    const color   = interaction.options.getString('color')?.replace('#', '') ?? '5865F2';
    const footer  = interaction.options.getString('footer');
    const useEmbed = interaction.options.getBoolean('embed') ?? true;

    if (guildTemplates.has(name)) {
      return interaction.reply({ content: `❌ Template \`${name}\` already exists. Use \`/template edit\` to modify it.`, ephemeral: true });
    }
    if (guildTemplates.size >= 30) {
      return interaction.reply({ content: '❌ Maximum 30 templates per server.', ephemeral: true });
    }

    guildTemplates.set(name, { name, content, title, color, footer, useEmbed });
    templates.set(guildId, guildTemplates);

    const embed = new EmbedBuilder()
      .setColor(0x00FF88)
      .setTitle('✅ Template Created')
      .addFields(
        { name: 'Name', value: `\`${name}\``, inline: true },
        { name: 'Type', value: useEmbed ? 'Embed' : 'Plain text', inline: true },
        { name: 'Content', value: content.slice(0, 200) },
      )
      .setFooter({ text: 'Use this template with /customcommand create' });
    await interaction.reply({ embeds: [embed], ephemeral: true });

  } else if (sub === 'delete') {
    const name = interaction.options.getString('name').toLowerCase();
    if (!guildTemplates.has(name)) return interaction.reply({ content: `❌ Template \`${name}\` not found.`, ephemeral: true });
    guildTemplates.delete(name);
    templates.set(guildId, guildTemplates);
    await interaction.reply({ content: `✅ Template \`${name}\` deleted.`, ephemeral: true });

  } else if (sub === 'list') {
    if (guildTemplates.size === 0) {
      return interaction.reply({ content: '📭 No templates yet. Use `/template create` to make one.', ephemeral: true });
    }
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📄 Templates (${guildTemplates.size}/30)`)
      .setDescription(
        [...guildTemplates.values()].map((t, i) =>
          `**${i + 1}.** \`${t.name}\` — ${t.useEmbed ? '🖼️ Embed' : '💬 Plain'}\n   ${t.content.slice(0, 80)}${t.content.length > 80 ? '...' : ''}`
        ).join('\n\n')
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });

  } else if (sub === 'preview') {
    const name = interaction.options.getString('name').toLowerCase();
    const t = guildTemplates.get(name);
    if (!t) return interaction.reply({ content: `❌ Template \`${name}\` not found.`, ephemeral: true });

    const rendered = renderTemplate(t, interaction.member, interaction.guild, interaction.channel);
    await interaction.reply({ ...rendered, ephemeral: true });

  } else if (sub === 'edit') {
    const name = interaction.options.getString('name').toLowerCase();
    const t = guildTemplates.get(name);
    if (!t) return interaction.reply({ content: `❌ Template \`${name}\` not found.`, ephemeral: true });

    if (interaction.options.getString('content')) t.content = interaction.options.getString('content');
    if (interaction.options.getString('title'))   t.title   = interaction.options.getString('title');
    if (interaction.options.getString('color'))   t.color   = interaction.options.getString('color').replace('#', '');
    if (interaction.options.getString('footer'))  t.footer  = interaction.options.getString('footer');

    guildTemplates.set(name, t);
    templates.set(guildId, guildTemplates);
    await interaction.reply({ content: `✅ Template \`${name}\` updated.`, ephemeral: true });
  }
}

export async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const guildTemplates = templates.get(interaction.guild.id) ?? new Map();
  const choices = [...guildTemplates.keys()]
    .filter(k => k.startsWith(focused))
    .slice(0, 25)
    .map(k => ({ name: k, value: k }));
  await interaction.respond(choices);
}

// Render a template with variable substitution
export function renderTemplate(template, member, guild, channel) {
  const content = template.content
    .replace(/\{user\}/gi, member?.toString() ?? 'User')
    .replace(/\{username\}/gi, member?.user?.username ?? 'User')
    .replace(/\{server\}/gi, guild?.name ?? 'Server')
    .replace(/\{channel\}/gi, channel?.toString() ?? 'channel')
    .replace(/\{membercount\}/gi, guild?.memberCount?.toString() ?? '?');

  if (!template.useEmbed) return { content };

  const embed = new EmbedBuilder()
    .setDescription(content)
    .setColor(parseInt(template.color ?? '5865F2', 16));

  if (template.title)  embed.setTitle(template.title);
  if (template.footer) embed.setFooter({ text: template.footer });

  return { embeds: [embed] };
}
