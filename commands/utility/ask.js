import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Ask NexusBot AI anything')
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

  if (!process.env.GROQ_API_KEY) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ AI Not Configured')
          .setDescription('The server admin needs to add `GROQ_API_KEY` to the bot environment variables.')
      ],
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral });

  try {
    const { default: Groq } = await import('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 800,
      messages: [
        {
          role: 'system',
          content: `You are NexusBot, a helpful Discord bot assistant for the server "${interaction.guild.name}".
Be concise, clear and friendly. Format your response nicely for Discord (use markdown where helpful).
Never mention any AI company, model name, or that you are an AI — you are NexusBot.
Keep responses under 800 characters when possible.`,
        },
        {
          role: 'user',
          content: question,
        },
      ],
    });

    const answer = completion.choices[0].message.content;
    const chunks = splitIntoChunks(answer, 3900);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({
        name: `${interaction.user.username} asked:`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setDescription(`**${question}**\n\n${chunks[0]}`)
      .setFooter({ text: 'NexusBot AI' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp({
        embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(chunks[i])],
        ephemeral,
      });
    }

  } catch (err) {
    console.error('❌ /ask Groq error:', err.message);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Error')
          .setDescription('⚡ Something went wrong. Try again in a moment.')
      ],
    });
  }
}

function splitIntoChunks(text, maxLen) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt === -1) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}
