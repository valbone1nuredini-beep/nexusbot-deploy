// bot/index.js — NexusBot main entry point
import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join, resolve } from 'path';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

// Load .env from the project root (one level up from /bot)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

// ── Anthropic (Claude) client ─────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function getClaudeReply(userMessage, username, serverName) {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 150,
      system: `You are NexusBot, a witty and helpful Discord bot for the server "${serverName}". 
Keep replies SHORT (1-2 sentences max), casual, and fun. 
You can be a little sarcastic but always friendly. 
Never break character. Never say you're Claude or an AI assistant.`,
      messages: [{ role: 'user', content: `${username} pinged you and said: "${userMessage || 'just pinged you with no message'}"` }],
    });
    return msg.content[0].text;
  } catch (err) {
    // Fallback responses if Claude fails
    const fallbacks = [
      "⚡ Yeah, I'm here. What do you need?",
      "🤖 Online and ready. Try a slash command!",
      "👀 You pinged me? Bold move.",
      "🔴 NexusBot reporting for duty.",
      "💀 You rang? I was busy banning people.",
      "🎯 Pong! What's up?",
      "🔥 Still here. Still watching.",
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// ── Load commands ─────────────────────────────────────────────────────────────
client.commands = new Collection();

const commandFolders = readdirSync(join(__dirname, 'commands'));
for (const folder of commandFolders) {
  const files = readdirSync(join(__dirname, 'commands', folder)).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const filePath = join(__dirname, 'commands', folder, file);
    const command = await import(pathToFileURL(filePath).href);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`  ✅ Loaded command: /${command.data.name}`);
    }
  }
}

// ── Load events ───────────────────────────────────────────────────────────────
const eventFiles = readdirSync(join(__dirname, 'events')).filter(f => f.endsWith('.js'));
for (const file of eventFiles) {
  const filePath = join(__dirname, 'events', file);
  const event = await import(pathToFileURL(filePath).href);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
  console.log(`  ✅ Loaded event: ${event.name}`);
}

// ── Handle slash commands ─────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async interaction => {
  // Handle autocomplete
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command?.autocomplete) {
      try { await command.autocomplete(interaction); } catch {}
    }
    return;
  }

  // Handle button interactions
  if (interaction.isButton()) {
    const { customId } = interaction;

    if (customId.startsWith('verify_btn_')) {
      try {
        const { handleVerifyButton } = await import('./commands/utility/verify.js');
        await handleVerifyButton(interaction);
      } catch (err) { console.error('[verify_btn]', err); }
      return;
    }

    if (customId.startsWith('rules_accept_')) {
      try {
        const { handleRulesAccept } = await import('./commands/utility/rules.js');
        await handleRulesAccept(interaction);
      } catch (err) { console.error('[rules_accept]', err); }
      return;
    }

    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    await interaction.reply({ content: '❌ Unknown command.', ephemeral: true });
    return;
  }

  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(`Error in /${interaction.commandName}:`, err);
    const msg = { content: '❌ An error occurred while running this command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
});

// ── AutoMod — messageCreate ───────────────────────────────────────────────────

// ── Ping responses ────────────────────────────────────────────────────────────
const pingResponses = [
  "⚡ Yeah, I'm here. What do you need?",
  "🤖 Online and ready. Try a slash command to see what I can do.",
  "👀 You pinged me? Bold move. I respect it.",
  "🔴 NexusBot reporting for duty. What's the mission?",
  "💀 You rang? I was busy banning people.",
  "🎯 Pong! Latency: faster than your reaction time.",
  "😤 I was literally in the middle of something. What?",
  "🚀 Present. Now stop pinging me and use a slash command.",
  "🔥 Still here. Still watching. Always watching.",
  "⚙️ Systems nominal. All commands loaded. What do you want?",
];

const spamTracker = new Map(); // userId -> [timestamps]

client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;

  // Respond when bot is mentioned/pinged — powered by Claude AI
  if (message.mentions.has(client.user)) {
    const userText = message.content.replace(/<@!?\d+>/g, '').trim();
    try {
      await message.channel.sendTyping();
      const reply = await getClaudeReply(userText, message.author.username, message.guild.name);
      await message.reply(reply).catch(() => {});
    } catch {
      await message.reply('⚡ Hey! What do you need?').catch(() => {});
    }
    return;
  }

  // Auto-responders
  try {
    const { checkAutoRespond } = await import('./commands/utility/autorespond.js');
    const autoReply = checkAutoRespond(message, message.guild.id);
    if (autoReply) {
      await message.reply(autoReply).catch(() => {});
      return;
    }
  } catch {}

  // Prefix custom commands (e.g. !commandname)
  if (message.content.startsWith('!')) {
    const cmdName = message.content.slice(1).split(' ')[0].toLowerCase();
    if (cmdName) {
      try {
        const { runCustomCommand } = await import('./commands/utility/customcommand.js');
        const handled = await runCustomCommand(cmdName, message.guild, message.member, message.channel, message);
        if (handled) return;
      } catch {}
    }
  }

  let { automodConfig } = await import('./commands/moderation/automod.js');
  const cfg = automodConfig.get(message.guild.id);
  if (!cfg) return;

  const logChannel = cfg.logChannelId ? message.guild.channels.cache.get(cfg.logChannelId) : null;

  const logAction = async (reason) => {
    if (!logChannel) return;
    const { EmbedBuilder } = await import('discord.js');
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🛡️ AutoMod Action')
      .addFields(
        { name: 'User',    value: `${message.author.tag} (${message.author.id})`, inline: true },
        { name: 'Channel', value: `<#${message.channel.id}>`,                     inline: true },
        { name: 'Reason',  value: reason },
        { name: 'Message', value: message.content.slice(0, 200) || '(empty)' },
      )
      .setTimestamp();
    await logChannel.send({ embeds: [embed] }).catch(() => {});
  };

  // Anti-spam: more than 5 messages in 5 seconds
  if (cfg.antiSpam) {
    const now = Date.now();
    const key = `${message.guild.id}-${message.author.id}`;
    const timestamps = spamTracker.get(key) ?? [];
    const recent = timestamps.filter(t => now - t < 5000);
    recent.push(now);
    spamTracker.set(key, recent);

    if (recent.length >= 5) {
      await message.delete().catch(() => {});
      await logAction('Anti-Spam: Sending messages too fast');
      try {
        await message.author.send(`⚠️ **${message.guild.name}:** You are sending messages too fast. Please slow down.`);
      } catch {}
      spamTracker.set(key, []);
      return;
    }
  }

  // Anti-link: block URLs
  if (cfg.antiLink) {
    const urlRegex = /(https?:\/\/|discord\.gg\/|www\.)\S+/gi;
    if (urlRegex.test(message.content)) {
      // Allow server admins/mods
      if (!message.member.permissions.has('ManageMessages')) {
        await message.delete().catch(() => {});
        await logAction('Anti-Link: Message contained a link');
        try {
          await message.author.send(`⚠️ **${message.guild.name}:** Links are not allowed in this server.`);
        } catch {}
        return;
      }
    }
  }

  // Bad words filter
  if (cfg.badWords && cfg.badWordList?.length) {
    const lower = message.content.toLowerCase();
    const found = cfg.badWordList.find(w => lower.includes(w));
    if (found) {
      if (!message.member.permissions.has('ManageMessages')) {
        await message.delete().catch(() => {});
        await logAction(`Bad Word Filter: Message contained banned word`);
        try {
          await message.author.send(`⚠️ **${message.guild.name}:** Your message was removed for containing a banned word.`);
        } catch {}
        return;
      }
    }
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN not set in .env');
  process.exit(1);
}

client.login(token);
