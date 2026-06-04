import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import OpenAI from 'openai';

export const data = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Ask ChatGPT anything directly')
  .addStringOption(o =>
    o.setName('question')
      .setDescription('What do you want to ask?')
      .setRequired(true)
      .setMaxLength(1000)
  )
  .addBooleanOption(o =>
    o.setName('private')
      .setDescription('Only you can see the response (default: false)')
      .setRequired(false)
  );

export async function execute(interaction) {
  const question = interaction.options.getString('question');
  const ephemeral = interaction.options.getBoolean('private') ?? false;

  // Check key
  if (!process.env.OPENAI_API_KEY) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ ChatGPT Not Configured')
          .setDescription('The server admin needs to add `OPENAI_API_KEY` to the bot environment variables.')
      ],
      ephemeral: true,
    });
  }

  // Defer so we have time to call OpenAI
  await interaction.deferReply({ ephemeral });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      messages: [
        {
          role: 'system',
          content: `You are NexusBot, a helpful Discord bot assistant for the server "${interaction.guild.name}".
Be concise, clear and friendly. Format your response nicely for Discord (use markdown where helpful).
Never mention OpenAI, ChatGPT, or that you are an AI — you are NexusBot.
Keep responses under 800 characters when possible.`,
        },
        {
          role: 'user',
          content: question,
        },
      ],
    });

    const answer = completion.choices[0].message.content;

    // Split long answers into chunks (Discord embed limit is 4096)
    const chunks = splitIntoChunks(answer, 3900);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({
        name: `${interaction.user.username} asked:`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setDescription(`**${question}**\n\n${chunks[0]}`)
      .setFooter({ text: 'Powered by NexusBot AI' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // If answer was very long, send extra chunks as follow-ups
    for (let i = 1; i < chunks.length; i++) {
      const extra = new EmbedBuilder()
        .setColor(0x5865F2)
        .setDescription(chunks[i]);
      await interaction.followUp({ embeds: [extra], ephemeral });
    }

  } catch (err) {
    console.error('❌ /ask OpenAI error:', err.message);

    const isQuotaError = err.message?.includes('quota') || err.status === 429;
    const isAuthError = err.status === 401;

    let desc = '⚡ Something went wrong while contacting ChatGPT. Try again in a moment.';
    if (isQuotaError) desc = '⚠️ The OpenAI API quota has been exceeded. The server admin needs to check their billing.';
    if (isAuthError) desc = '🔑 The `OPENAI_API_KEY` is invalid. The server admin needs to update it in Railway.';

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Error')
          .setDescription(desc)
      ],
    });
  }
}

function splitIntoChunks(text, maxLen) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    // Try to split at a newline
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt === -1) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}
