// commands/utility/autorespond.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

// Store: guildId -> [ { trigger, response, matchType, enabled } ]
export const autoResponders = new Map();

export const data = new SlashCommandBuilder()
  .setName('autorespond')
  .setDescription('Manage auto-responders for this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub => sub
    .setName('add')
    .setDescription('Add a new auto-responder')
    .addStringOption(o => o.setName('trigger').setDescription('Word or phrase that triggers the response').setRequired(true))
    .addStringOption(o => o.setName('response').setDescription('What the bot should reply').setRequired(true))
    .addStringOption(o => o.setName('match')
      .setDescription('How to match the trigger (default: contains)')
      .setRequired(false)
      .addChoices(
        { name: 'Contains (default)', value: 'contains' },
        { name: 'Exact match', value: 'exact' },
        { name: 'Starts with', value: 'startswith' },
      )))
  .addSubcommand(sub => sub
    .setName('remove')
    .setDescription('Remove an auto-responder')
    .addStringOption(o => o.setName('trigger').setDescription('Trigger to remove').setRequired(true).setAutocomplete(true)))
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('List all auto-responders'))
  .addSubcommand(sub => sub
    .setName('toggle')
    .setDescription('Enable or disable an auto-responder')
    .addStringOption(o => o.setName('trigger').setDescription('Trigger to toggle').setRequired(true).setAutocomplete(true)))
  .addSubcommand(sub => sub
    .setName('edit')
    .setDescription('Edit an existing auto-responder')
    .addStringOption(o => o.setName('trigger').setDescription('Trigger to edit').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('response').setDescription('New response').setRequired(true)));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const list = autoResponders.get(guildId) ?? [];

  if (sub === 'add') {
    const trigger  = interaction.options.getString('trigger').toLowerCase();
    const response = interaction.options.getString('response');
    const match    = interaction.options.getString('match') ?? 'contains';

    if (list.find(r => r.trigger === trigger)) {
      return interaction.reply({ content: `❌ A responder for \`${trigger}\` already exists. Use \`/autorespond edit\` to change it.`, ephemeral: true });
    }
    if (list.length >= 50) {
      return interaction.reply({ content: '❌ You can have a maximum of 50 auto-responders.', ephemeral: true });
    }

    list.push({ trigger, response, matchType: match, enabled: true });
    autoResponders.set(guildId, list);

    const embed = new EmbedBuilder()
      .setColor(0x00FF88)
      .setTitle('✅ Auto-Responder Added')
      .addFields(
        { name: 'Trigger', value: `\`${trigger}\``, inline: true },
        { name: 'Match Type', value: match, inline: true },
        { name: 'Response', value: response.slice(0, 200) },
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });

  } else if (sub === 'remove') {
    const trigger = interaction.options.getString('trigger').toLowerCase();
    const idx = list.findIndex(r => r.trigger === trigger);
    if (idx === -1) return interaction.reply({ content: `❌ No responder found for \`${trigger}\`.`, ephemeral: true });

    list.splice(idx, 1);
    autoResponders.set(guildId, list);
    await interaction.reply({ content: `✅ Removed auto-responder for \`${trigger}\`.`, ephemeral: true });

  } else if (sub === 'list') {
    const active = autoResponders.get(guildId) ?? [];
    if (active.length === 0) {
      return interaction.reply({ content: '📭 No auto-responders set up yet. Use `/autorespond add` to create one.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📋 Auto-Responders (${active.length}/50)`)
      .setDescription(
        active.map((r, i) =>
          `**${i + 1}.** \`${r.trigger}\` → ${r.response.slice(0, 60)}${r.response.length > 60 ? '...' : ''}\n` +
          `   Match: \`${r.matchType}\` | ${r.enabled ? '🟢 Enabled' : '🔴 Disabled'}`
        ).join('\n\n')
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });

  } else if (sub === 'toggle') {
    const trigger = interaction.options.getString('trigger').toLowerCase();
    const item = list.find(r => r.trigger === trigger);
    if (!item) return interaction.reply({ content: `❌ No responder found for \`${trigger}\`.`, ephemeral: true });

    item.enabled = !item.enabled;
    autoResponders.set(guildId, list);
    await interaction.reply({ content: `${item.enabled ? '🟢 Enabled' : '🔴 Disabled'} auto-responder for \`${trigger}\`.`, ephemeral: true });

  } else if (sub === 'edit') {
    const trigger  = interaction.options.getString('trigger').toLowerCase();
    const response = interaction.options.getString('response');
    const item = list.find(r => r.trigger === trigger);
    if (!item) return interaction.reply({ content: `❌ No responder found for \`${trigger}\`.`, ephemeral: true });

    item.response = response;
    autoResponders.set(guildId, list);
    await interaction.reply({ content: `✅ Updated response for \`${trigger}\`.`, ephemeral: true });
  }
}

// Handle autocomplete
export async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const list = autoResponders.get(interaction.guild.id) ?? [];
  const choices = list
    .filter(r => r.trigger.startsWith(focused))
    .slice(0, 25)
    .map(r => ({ name: r.trigger, value: r.trigger }));
  await interaction.respond(choices);
}

// Called from messageCreate in index.js
export function checkAutoRespond(message, guildId) {
  const list = autoResponders.get(guildId);
  if (!list || list.length === 0) return null;

  const content = message.content.toLowerCase();
  for (const r of list) {
    if (!r.enabled) continue;
    let matched = false;
    if (r.matchType === 'exact')      matched = content === r.trigger;
    else if (r.matchType === 'startswith') matched = content.startsWith(r.trigger);
    else                               matched = content.includes(r.trigger); // contains
    if (matched) return r.response;
  }
  return null;
}
