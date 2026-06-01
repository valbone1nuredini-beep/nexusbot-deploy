// commands/utility/customcommand.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { templates, renderTemplate } from './template.js';

// Store: guildId -> Map<commandName, { name, description, templateName, allowedRoles, cooldown, uses }>
export const customCommands = new Map();
const cooldowns = new Map(); // `${guildId}-${cmdName}-${userId}` -> timestamp

export const data = new SlashCommandBuilder()
  .setName('customcommand')
  .setDescription('Create custom slash-style commands powered by templates')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub => sub
    .setName('create')
    .setDescription('Create a new custom command')
    .addStringOption(o => o.setName('name').setDescription('Command name (no spaces, no slash)').setRequired(true))
    .addStringOption(o => o.setName('template').setDescription('Template to use (from /template list)').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('description').setDescription('What this command does').setRequired(false))
    .addIntegerOption(o => o.setName('cooldown').setDescription('Cooldown in seconds (default: 0)').setMinValue(0).setMaxValue(3600).setRequired(false)))
  .addSubcommand(sub => sub
    .setName('delete')
    .setDescription('Delete a custom command')
    .addStringOption(o => o.setName('name').setDescription('Command name').setRequired(true).setAutocomplete(true)))
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('List all custom commands'))
  .addSubcommand(sub => sub
    .setName('info')
    .setDescription('View details about a custom command')
    .addStringOption(o => o.setName('name').setDescription('Command name').setRequired(true).setAutocomplete(true)))
  .addSubcommand(sub => sub
    .setName('run')
    .setDescription('Run a custom command')
    .addStringOption(o => o.setName('name').setDescription('Command name to run').setRequired(true).setAutocomplete(true)));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const guildCmds = customCommands.get(guildId) ?? new Map();

  if (sub === 'create') {
    const name         = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
    const templateName = interaction.options.getString('template').toLowerCase();
    const description  = interaction.options.getString('description') ?? `Custom command: ${name}`;
    const cooldown     = interaction.options.getInteger('cooldown') ?? 0;

    if (guildCmds.has(name)) {
      return interaction.reply({ content: `❌ Command \`${name}\` already exists.`, ephemeral: true });
    }
    if (guildCmds.size >= 50) {
      return interaction.reply({ content: '❌ Maximum 50 custom commands per server.', ephemeral: true });
    }

    // Check template exists
    const guildTemplates = templates.get(guildId);
    if (!guildTemplates?.has(templateName)) {
      return interaction.reply({
        content: `❌ Template \`${templateName}\` not found.\nCreate one first with \`/template create\`.`,
        ephemeral: true,
      });
    }

    guildCmds.set(name, { name, description, templateName, cooldown, uses: 0 });
    customCommands.set(guildId, guildCmds);

    const embed = new EmbedBuilder()
      .setColor(0x00FF88)
      .setTitle('✅ Custom Command Created')
      .addFields(
        { name: 'Command', value: `\`!${name}\` or \`/customcommand run ${name}\``, inline: false },
        { name: 'Template', value: `\`${templateName}\``, inline: true },
        { name: 'Cooldown', value: cooldown > 0 ? `${cooldown}s` : 'None', inline: true },
        { name: 'Description', value: description },
      )
      .setFooter({ text: 'Members can run it with !commandname or /customcommand run commandname' });
    await interaction.reply({ embeds: [embed], ephemeral: true });

  } else if (sub === 'delete') {
    const name = interaction.options.getString('name').toLowerCase();
    if (!guildCmds.has(name)) return interaction.reply({ content: `❌ Command \`${name}\` not found.`, ephemeral: true });
    guildCmds.delete(name);
    customCommands.set(guildId, guildCmds);
    await interaction.reply({ content: `✅ Custom command \`${name}\` deleted.`, ephemeral: true });

  } else if (sub === 'list') {
    if (guildCmds.size === 0) {
      return interaction.reply({ content: '📭 No custom commands yet. Use `/customcommand create` to make one.', ephemeral: true });
    }
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`⚙️ Custom Commands (${guildCmds.size}/50)`)
      .setDescription(
        [...guildCmds.values()].map((c, i) =>
          `**${i + 1}.** \`!${c.name}\` — ${c.description}\n   Template: \`${c.templateName}\` | Uses: ${c.uses} | Cooldown: ${c.cooldown > 0 ? `${c.cooldown}s` : 'None'}`
        ).join('\n\n')
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });

  } else if (sub === 'info') {
    const name = interaction.options.getString('name').toLowerCase();
    const cmd = guildCmds.get(name);
    if (!cmd) return interaction.reply({ content: `❌ Command \`${name}\` not found.`, ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`⚙️ Command: !${cmd.name}`)
      .addFields(
        { name: 'Description', value: cmd.description },
        { name: 'Template', value: `\`${cmd.templateName}\``, inline: true },
        { name: 'Cooldown', value: cmd.cooldown > 0 ? `${cmd.cooldown}s` : 'None', inline: true },
        { name: 'Total Uses', value: cmd.uses.toString(), inline: true },
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });

  } else if (sub === 'run') {
    const name = interaction.options.getString('name').toLowerCase();
    await runCustomCommand(name, interaction.guild, interaction.member, interaction.channel, interaction);
  }
}

export async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const guildId = interaction.guild.id;
  const optionName = interaction.options.getFocused(true).name;

  if (optionName === 'template') {
    const guildTemplates = templates.get(guildId) ?? new Map();
    const choices = [...guildTemplates.keys()]
      .filter(k => k.startsWith(focused))
      .slice(0, 25)
      .map(k => ({ name: k, value: k }));
    return interaction.respond(choices);
  }

  const guildCmds = customCommands.get(guildId) ?? new Map();
  const choices = [...guildCmds.keys()]
    .filter(k => k.startsWith(focused))
    .slice(0, 25)
    .map(k => ({ name: k, value: k }));
  await interaction.respond(choices);
}

// Run a custom command — called from messageCreate (prefix) or /customcommand run
export async function runCustomCommand(name, guild, member, channel, interactionOrMessage) {
  const guildCmds = customCommands.get(guild.id);
  const cmd = guildCmds?.get(name);
  if (!cmd) return false;

  // Cooldown check
  if (cmd.cooldown > 0) {
    const key = `${guild.id}-${name}-${member.id}`;
    const last = cooldowns.get(key) ?? 0;
    const remaining = cmd.cooldown * 1000 - (Date.now() - last);
    if (remaining > 0) {
      const msg = `⏱️ Please wait **${(remaining / 1000).toFixed(1)}s** before using \`!${name}\` again.`;
      if (interactionOrMessage.reply) await interactionOrMessage.reply({ content: msg, ephemeral: true }).catch(() => {});
      return true;
    }
    cooldowns.set(key, Date.now());
  }

  // Get template
  const guildTemplates = templates.get(guild.id);
  const template = guildTemplates?.get(cmd.templateName);
  if (!template) {
    const msg = `❌ Template \`${cmd.templateName}\` no longer exists. Ask an admin to fix this command.`;
    if (interactionOrMessage.reply) await interactionOrMessage.reply({ content: msg, ephemeral: true }).catch(() => {});
    return true;
  }

  cmd.uses++;
  const rendered = renderTemplate(template, member, guild, channel);

  if (interactionOrMessage.isChatInputCommand?.()) {
    await interactionOrMessage.reply(rendered).catch(() => {});
  } else {
    await channel.send(rendered).catch(() => {});
  }
  return true;
}
