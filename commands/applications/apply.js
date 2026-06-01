// bot/commands/applications/apply.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } from 'discord.js';

export const appForms    = new Map(); // guildId -> Map(formName -> { questions[], reviewChannelId, open })
export const submissions = new Map(); // submissionId -> { formName, userId, guildId, answers[], status }

let submissionCounter = 1;

export const data = new SlashCommandBuilder()
  .setName('apply')
  .setDescription('📋 Manage application forms (Premium)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub => sub
    .setName('create')
    .setDescription('Create a new application form')
    .addStringOption(o => o.setName('name').setDescription('Form name (e.g. staff, partner)').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('open')
    .setDescription('Open an application form for submissions')
    .addStringOption(o => o.setName('form').setDescription('Form name').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Channel to post the apply button').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption(o => o.setName('review_channel').setDescription('Channel to receive submissions').addChannelTypes(ChannelType.GuildText).setRequired(true)))
  .addSubcommand(sub => sub
    .setName('close')
    .setDescription('Close an application form')
    .addStringOption(o => o.setName('form').setDescription('Form name').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('List all application forms'));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (!appForms.has(interaction.guild.id)) appForms.set(interaction.guild.id, new Map());
  const guildForms = appForms.get(interaction.guild.id);

  if (sub === 'create') {
    const name = interaction.options.getString('name').toLowerCase();
    if (guildForms.has(name)) return interaction.reply({ content: `❌ Form \`${name}\` already exists.`, ephemeral: true });

    guildForms.set(name, {
      name,
      questions: [
        'What is your age?',
        'Why do you want to join?',
        'Do you have any relevant experience?',
        'How many hours per week can you dedicate?',
      ],
      open: false,
    });

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x00FF88)
        .setTitle('✅ Application Form Created')
        .setDescription(`Form \`${name}\` created with 4 default questions.\nUse \`/apply open\` to open it for submissions.`)],
      ephemeral: true,
    });

  } else if (sub === 'open') {
    const name    = interaction.options.getString('form').toLowerCase();
    const channel = interaction.options.getChannel('channel');
    const review  = interaction.options.getChannel('review_channel');
    const form    = guildForms.get(name);

    if (!form) return interaction.reply({ content: `❌ Form \`${name}\` not found. Create it first with \`/apply create\`.`, ephemeral: true });

    form.open = true;
    form.reviewChannelId = review.id;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📋 ${name.charAt(0).toUpperCase() + name.slice(1)} Applications`)
      .setDescription(`Applications are now open!\n\nClick the button below to apply.\n\n**Questions (${form.questions.length}):**\n${form.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`)
      .setFooter({ text: interaction.guild.name });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`apply_start_${name}`)
        .setLabel(`Apply for ${name}`)
        .setEmoji('📋')
        .setStyle(ButtonStyle.Primary),
    );

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ Application form \`${name}\` opened in ${channel}`, ephemeral: true });

  } else if (sub === 'close') {
    const name = interaction.options.getString('form').toLowerCase();
    const form = guildForms.get(name);
    if (!form) return interaction.reply({ content: `❌ Form \`${name}\` not found.`, ephemeral: true });
    form.open = false;
    await interaction.reply({ content: `✅ Form \`${name}\` closed.`, ephemeral: true });

  } else if (sub === 'list') {
    const forms = [...guildForms.values()];
    if (forms.length === 0) return interaction.reply({ content: '📭 No forms created yet.', ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📋 Application Forms')
      .setDescription(forms.map(f => `**${f.name}** — ${f.open ? '🟢 Open' : '🔴 Closed'} — ${f.questions.length} questions`).join('\n'));

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
