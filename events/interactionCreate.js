// events/interactionCreate.js — single unified handler for ALL interactions
import { Events, EmbedBuilder } from 'discord.js';

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction, client) {

  // ── Autocomplete ────────────────────────────────────────────────────────────
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command?.autocomplete) {
      try { await command.autocomplete(interaction); } catch (err) {
        console.error(`[autocomplete:${interaction.commandName}]`, err);
      }
    }
    return;
  }

  // ── Slash commands ───────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      return interaction.reply({ content: '❌ Unknown command.', ephemeral: true }).catch(() => {});
    }
    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(`[command:${interaction.commandName}]`, err);
      const msg = { content: `❌ An error occurred: ${err.message}`, ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(msg).catch(() => {});
      } else {
        await interaction.reply(msg).catch(() => {});
      }
    }
    return;
  }

  // ── Button interactions ──────────────────────────────────────────────────────
  if (interaction.isButton()) {
    const { customId } = interaction;

    // Ticket open button
    if (customId === 'ticket_open') {
      try {
        const { handleButton } = await import('../commands/tickets/ticket.js');
        await handleButton(interaction);
      } catch (err) { console.error('[ticket_open]', err); }
      return;
    }

    // Ticket close button (in-channel)
    if (customId === 'ticket_close_btn') {
      try {
        const { openTickets } = await import('../commands/tickets/ticket.js');
        const ticket = openTickets.get(interaction.channel.id);
        if (!ticket) return interaction.reply({ content: '❌ Not a ticket channel.', ephemeral: true });
        await interaction.reply({ content: '🔒 Closing ticket in 5 seconds...' });
        setTimeout(async () => {
          openTickets.delete(interaction.channel.id);
          await interaction.channel.delete().catch(() => {});
        }, 5000);
      } catch (err) { console.error('[ticket_close_btn]', err); }
      return;
    }

    // Verify button
    if (customId.startsWith('verify_btn_')) {
      try {
        const { handleVerifyButton } = await import('../commands/utility/verify.js');
        await handleVerifyButton(interaction);
      } catch (err) { console.error('[verify_btn]', err); }
      return;
    }

    // Rules accept button
    if (customId.startsWith('rules_accept_')) {
      try {
        const { handleRulesAccept } = await import('../commands/utility/rules.js');
        await handleRulesAccept(interaction);
      } catch (err) { console.error('[rules_accept]', err); }
      return;
    }

    // Application start button
    if (customId.startsWith('apply_start_')) {
      try {
        const formName = customId.replace('apply_start_', '');
        const { appForms } = await import('../commands/applications/apply.js');
        const guildForms = appForms.get(interaction.guild.id);
        const form = guildForms?.get(formName);

        if (!form || !form.open) {
          return interaction.reply({ content: '❌ This application is currently closed.', ephemeral: true });
        }

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
        await interaction.showModal(modal);
      } catch (err) { console.error('[apply_start]', err); }
      return;
    }

    // Application accept/deny buttons
    if (customId.startsWith('app_accept_') || customId.startsWith('app_deny_')) {
      try {
        const accepted = customId.startsWith('app_accept_');
        const id = customId.replace(accepted ? 'app_accept_' : 'app_deny_', '');
        const { submissions } = await import('../commands/applications/apply.js');
        const sub = submissions.get(id);
        if (!sub) return interaction.reply({ content: '❌ Submission not found.', ephemeral: true });

        sub.status = accepted ? 'accepted' : 'denied';

        try {
          const user = await client.users.fetch(sub.userId);
          const guild = client.guilds.cache.get(sub.guildId);
          await user.send(`${accepted ? '✅ Congratulations!' : '❌ Unfortunately,'} your **${sub.formName}** application in **${guild?.name ?? 'the server'}** has been **${accepted ? 'accepted' : 'denied'}**.`);
        } catch {}

        const embed = new EmbedBuilder()
          .setColor(accepted ? 0x00FF88 : 0xFF0000)
          .setDescription(`${accepted ? '✅ Accepted' : '❌ Denied'} by ${interaction.user.tag}`);

        await interaction.update({ embeds: [...interaction.message.embeds, embed], components: [] });
      } catch (err) { console.error('[app_accept_deny]', err); }
      return;
    }

    return;
  }

  // ── Modal submissions ────────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('apply_submit_')) {
      try {
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
          id, formName,
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          answers,
          status: 'pending',
        });

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
      } catch (err) { console.error('[apply_submit]', err); }
      return;
    }
  }
}
