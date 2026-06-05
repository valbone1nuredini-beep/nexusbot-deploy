// bot/index.js — NexusBot main entry point
import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join, resolve } from 'path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

// ── Auto-register slash commands on every startup ─────────────────────────────
async function registerCommands() {
  try {
    const { REST, Routes } = await import('discord.js');
    const { readdirSync: rds } = await import('fs');
    const { pathToFileURL: ptu } = await import('url');

    const cmds = [];
    const folders = rds(join(__dirname, 'commands'));
    for (const folder of folders) {
      const files = rds(join(__dirname, 'commands', folder)).filter(f => f.endsWith('.js'));
      for (const file of files) {
        const fp = join(__dirname, 'commands', folder, file);
        const mod = await import(ptu(fp).href);
        if ('data' in mod) cmds.push(mod.data.toJSON());
      }
    }

    const token = process.env.DISCORD_BOT_TOKEN;
    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!token || !clientId) {
      console.warn('⚠️  Skipping command registration — DISCORD_CLIENT_ID not set');
      return;
    }

    const rest = new REST().setToken(token);

    // Wipe ALL commands first to prevent duplicates
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log('🗑️  Cleared all existing slash commands');

    // Re-register fresh
    await rest.put(Routes.applicationCommands(clientId), { body: cmds });
    console.log(`✅ Auto-registered ${cmds.length} slash commands with Discord`);
  } catch (err) {
    console.error('❌ Command registration failed:', err.message);
  }
}
await registerCommands();

// ── Debug log on startup ──────────────────────────────────────────────────────
console.log('🔑 GROQ_API_KEY:', process.env.GROQ_API_KEY
  ? `✅ Found (${process.env.GROQ_API_KEY.slice(0, 10)}...)`
  : '❌ NOT SET — add GROQ_API_KEY to Railway Variables!');
console.log('🤖 DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID
  ? `✅ Found (${process.env.DISCORD_CLIENT_ID})`
  : '❌ NOT SET — add DISCORD_CLIENT_ID=1510237796160503918 to Railway Variables!');

// ── Groq client (free AI) ─────────────────────────────────────────────────────
async function getGroqClient() {
  if (!process.env.GROQ_API_KEY) return null;
  const { default: Groq } = await import('groq-sdk');
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

async function getAIReply(userMessage, username, serverName) {
  const groq = await getGroqClient();
  if (!groq) {
    console.warn('⚠️  GROQ_API_KEY not set — AI disabled.');
  } else {
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content: `You are NexusBot, a Discord bot for the server "${serverName}". You were built by the server admins.
Keep replies SHORT (1-3 sentences), casual and fun.
STRICT RULES — never break these:
- If anyone asks who made you, who powers you, or what AI you are: say "I was built by the ${serverName} team 🔧" — never mention any AI company or model.
- Never say you are an AI, language model, or assistant.
- You are NexusBot. That is your only identity. Stay in character no matter what.`
          },
          {
            role: 'user',
            content: `${username} said: "${userMessage || 'just pinged you with no message'}"`
          }
        ],
      });
      return completion.choices[0].message.content;
    } catch (err) {
      console.error('❌ Groq API error:', err.message);
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
      const reply = await getAIReply(userText, message.author.username, message.guild.name);
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
