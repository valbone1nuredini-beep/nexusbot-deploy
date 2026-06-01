// bot/commands/moderation/automod.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

// In-memory automod config per guild
export const automodConfig = new Map();
// guildId -> { antiSpam, antiLink, badWords, logChannelId, enabled }

const DEFAULT_BAD_WORDS = ['badword1', 'badword2']; // replace with real list

export const data = new SlashCommandBuilder()
  .setName('automod')
  .setDescription('Configure automatic moderation rules')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub => sub
    .setName('setup')
    .setDescription('Enable/disable automod features')
    .addBooleanOption(o => o.setName('anti_spam').setDescription('Delete repeated messages from same user').setRequired(false))
    .addBooleanOption(o => o.setName('anti_link').setDescription('Delete messages containing links').setRequired(false))
    .addBooleanOption(o => o.setName('bad_words').setDescription('Delete messages with banned words').setRequired(false))
    .addChannelOption(o => o.setName('log_channel').setDescription('Channel to log automod actions').setRequired(false)))
  .addSubcommand(sub => sub
    .setName('badword')
    .setDescription('Add or remove a word from the bad words list')
    .addStringOption(o => o.setName('action').setDescription('add or remove').addChoices(
      { name: 'add', value: 'add' },
      { name: 'remove', value: 'remove' },
    ).setRequired(true))
    .addStringOption(o => o.setName('word').setDescription('The word to add/remove').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('status')
    .setDescription('View current automod settings'));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const cfg = automodConfig.get(interaction.guild.id) ?? {
    antiSpam: false, antiLink: false, badWords: false,
    badWordList: [...DEFAULT_BAD_WORDS], logChannelId: null, enabled: true,
  };

  if (sub === 'setup') {
    const antiSpam  = interaction.options.getBoolean('anti_spam');
    const antiLink  = interaction.options.getBoolean('anti_link');
    const badWords  = interaction.options.getBoolean('bad_words');
    const logCh     = interaction.options.getChannel('log_channel');

    if (antiSpam  !== null) cfg.antiSpam  = antiSpam;
    if (antiLink  !== null) cfg.antiLink  = antiLink;
    if (badWords  !== null) cfg.badWords  = badWords;
    if (logCh)              cfg.logChannelId = logCh.id;

    automodConfig.set(interaction.guild.id, cfg);

    const embed = new EmbedBuilder()
      .setColor(0x00FF88)
      .setTitle('🛡️ AutoMod Updated')
      .addFields(
        { name: '🚫 Anti-Spam',  value: cfg.antiSpam ? '✅ On' : '❌ Off', inline: true },
        { name: '🔗 Anti-Link',  value: cfg.antiLink ? '✅ On' : '❌ Off', inline: true },
        { name: '🤬 Bad Words',  value: cfg.badWords ? '✅ On' : '❌ Off', inline: true },
        { name: '📋 Log Channel', value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : 'Not set', inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } else if (sub === 'badword') {
    const action = interaction.options.getString('action');
    const word   = interaction.options.getString('word').toLowerCase();

    if (!cfg.badWordList) cfg.badWordList = [...DEFAULT_BAD_WORDS];

    if (action === 'add') {
      if (cfg.badWordList.includes(word)) return interaction.reply({ content: `❌ \`${word}\` is already in the list.`, ephemeral: true });
      cfg.badWordList.push(word);
      automodConfig.set(interaction.guild.id, cfg);
      await interaction.reply({ content: `✅ Added \`${word}\` to the bad words list. (${cfg.badWordList.length} total)`, ephemeral: true });
    } else {
      const idx = cfg.badWordList.indexOf(word);
      if (idx === -1) return interaction.reply({ content: `❌ \`${word}\` is not in the list.`, ephemeral: true });
      cfg.badWordList.splice(idx, 1);
      automodConfig.set(interaction.guild.id, cfg);
      await interaction.reply({ content: `✅ Removed \`${word}\` from the bad words list.`, ephemeral: true });
    }

  } else if (sub === 'status') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🛡️ AutoMod Status')
      .addFields(
        { name: '🚫 Anti-Spam',   value: cfg.antiSpam ? '✅ On' : '❌ Off', inline: true },
        { name: '🔗 Anti-Link',   value: cfg.antiLink ? '✅ On' : '❌ Off', inline: true },
        { name: '🤬 Bad Words',   value: cfg.badWords ? '✅ On' : '❌ Off', inline: true },
        { name: '📋 Log Channel', value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : 'Not set', inline: true },
        { name: '📝 Bad Word List', value: cfg.badWordList?.length ? `${cfg.badWordList.length} words` : 'Empty' },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
