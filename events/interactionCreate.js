// bot/events/interactionCreate.js — handles button clicks (tickets, applications)
import { Events } from 'discord.js';
import { handleButton as handleTicketButton, openTickets, ticketConfig } from '../commands/tickets/ticket.js';
import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction, client) {
  // Slash commands are handled in bot/index.js
  if (interaction.isChatInputCommand()) return;

  // ── Button interactions ───────────────────────────────────────────────────
  if (interaction.isButton()) {
    // Ticket open button
    if (interaction.customId === 'ticket_open') {
      return handleTicketButton(interaction);
    }

    // Ticket close button (in-channel)
    if (interaction.customId === 'ticket_close_btn') {
      const ticket = openTickets.get(interaction.channel.id);
      if (!ticket) return interaction.reply({ content: '❌ Not a ticket channel.', ephemeral: true });
      await interaction.reply({ content: '🔒 Closing ticket in 5 seconds...' });
      setTimeout(async () => {
        openTickets.delete(interaction.channel.id);
        await interaction.channel.delete().catch(() => {});
      }, 5000);
      return;
    }

    // Application start button
    if (interaction.customId.startsWith('apply_start_')) {
      const formName = interaction.customId.replace('apply_start_', '');
      const { appForms, submissions } = await import('../commands/applications/apply.js');
      const guildForms = appForms.get(interaction.guild.id);
      const form = guildForms?.get(formName);

      if (!form || !form.open) {
        return interaction.reply({ content: '❌ This application is currently closed.', ephemeral: true });
      }

      // Show a modal with up to 5 questions (Discord modal limit)
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
      const modal = new ModalBuilder()
        .setCustomId(`apply_submit_${formName}`)
        .setTitle(`${formName.charAt(0).toUpperCase() + formName.slice(1)} Application`);

      const questions = form.questions.slice(0, 5);
      for (let i = 0; i < questions.length; i++) {
        const input = new TextInputBuilder()
          .setCustomId(`q_${i}`)
          .setLabel(questions[i].slice(0, 45))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
      }

      return interaction.showModal(modal);
    }
  }

  // ── Modal submissions ─────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('apply_submit_')) {
      const formName = interaction.customId.replace('apply_submit_', '');
      const { appForms, submissions } = await import('../commands/applications/apply.js');
      const guildForms = appForms.get(interaction.guild.id);
      const form = guildForms?.get(formName);
      if (!form) return interaction.reply({ content: '❌ Form not found.', ephemeral: true });

      const answers = form.questions.slice(0, 5).map((q, i) => ({
        question: q,
        answer: interaction.fields.getTextInputValue(`q_${i}`),
      }));

      const id = `APP-${Date.now()}`;
      submissions.set(id, {
        id,
        formName,
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        answers,
        status: 'pending',
      });

      // Send to review channel
      if (form.reviewChannelId) {
        const reviewChannel = interaction.guild.channels.cache.get(form.reviewChannelId);
        if (reviewChannel) {
          const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📋 New ${formName} Application`)
            .setDescription(`**Applicant:** ${interaction.user.tag} (${interaction.user.id})\n**ID:** \`${id}\``)
            .addFields(answers.map(a => ({ name: a.question, value: a.answer })))
            .setTimestamp();

          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`app_accept_${id}`).setLabel('Accept').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`app_deny_${id}`).setLabel('Deny').setStyle(ButtonStyle.Danger),
          );

          await reviewChannel.send({ embeds: [embed], components: [row] });
        }
      }

      await interaction.reply({ content: `✅ Your **${formName}** application has been submitted! We'll review it soon.`, ephemeral: true });
    }

    // Accept/deny application buttons
    if (interaction.isButton?.() && interaction.customId?.startsWith('app_accept_')) {
      // handled below
    }
  }

  // Accept/deny buttons on application review
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('app_accept_') || interaction.customId.startsWith('app_deny_')) {
      const accepted = interaction.customId.startsWith('app_accept_');
      const id = interaction.customId.replace(accepted ? 'app_accept_' : 'app_deny_', '');
      const { submissions } = await import('../commands/applications/apply.js');
      const sub = submissions.get(id);
      if (!sub) return interaction.reply({ content: '❌ Submission not found.', ephemeral: true });

      sub.status = accepted ? 'accepted' : 'denied';

      // DM the applicant
      try {
        const user = await client.users.fetch(sub.userId);
        const guild = client.guilds.cache.get(sub.guildId);
        await user.send(`${accepted ? '✅ Congratulations!' : '❌ Unfortunately,'} your **${sub.formName}** application in **${guild?.name ?? 'the server'}** has been **${accepted ? 'accepted' : 'denied'}**.`);
      } catch {}

      const embed = new EmbedBuilder()
        .setColor(accepted ? 0x00FF88 : 0xFF0000)
        .setDescription(`${accepted ? '✅ Accepted' : '❌ Denied'} by ${interaction.user.tag}`);

      await interaction.update({ embeds: [...interaction.message.embeds, embed], components: [] });
    }
  }
}
