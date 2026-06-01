// bot/index.js — NexusBot main entry point
import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join, resolve } from 'path';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

// Load .env from the project root (one level up from /bot)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

// ── Anthropic (Claude) client ─────────────────────────────────────────────────
// Only init Anthropic if the key exists
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

async function getClaudeReply(userMessage, username, serverName) {
  // If no API key, log clearly and use fallback
  if (!anthropic) {
    console.warn('⚠️  ANTHROPIC_API_KEY not set — Claude AI disabled. Add it to Railway environment variables.');
  } else {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 200,
        system: `You are NexusBot, a witty and helpful Discord bot for the server "${serverName}".
Keep replies SHORT (1-3 sentences max), casual, conversational and fun.
You can be a little sarcastic but always friendly and helpful.
If someone asks you something, actually answer it properly.
Never say you're Claude or an AI assistant — you are NexusBot.
Never say "NexusBot on duty" or "reporting for duty" — that's cringe.`,
        messages: [{ role: 'user', content: `${username} said: "${userMessage || 'just pinged you with no message'}"` }],
      });
      return msg.content[0].text;
    } catch (err) {
      console.error('❌ Claude API error:', err.message);
    }
  }

  // Fallback — only used if Claude fails or key is missing
  const text = (userMessage || '').toLowerCase();
  if (text.includes('hello') || text.includes('hi') || text.includes('hey')) {
    return `Hey ${username}! 👋 What's up?`;
  } else if (text.includes('help')) {
    return `Need help? Try typing \`/\` to see all my commands! 🛠️`;
  } else if (text.includes('ban') || text.includes('kick')) {
    return `👀 Who are we banning? Use \`/ban @user\` and I'll handle it.`;
  } else if (text.includes('giveaway')) {
    return `🎉 Want to start a giveaway? Use \`/giveaway start\`!`;
  } else if (!userMessage || userMessage.trim() === '') {
    return `You pinged me but said nothing... bold move ${username} 👀`;
  } else {
    const fallbacks = [
      `Interesting point, ${username}. I'll pretend I understood that. 😅`,
      `I heard you ${username}! Try a slash command if you need something specific.`,
      `👀 I'm watching. What do you need, ${username}?`,
      `On it. Just kidding, I have no idea what you want. Try \`/help\`? 😂`,
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
