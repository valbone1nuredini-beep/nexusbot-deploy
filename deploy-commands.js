// bot/deploy-commands.js — registers all slash commands with Discord
import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join, resolve } from 'path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const commands = [];
const commandFolders = readdirSync(join(__dirname, 'commands'));

for (const folder of commandFolders) {
  const files = readdirSync(join(__dirname, 'commands', folder)).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const filePath = join(__dirname, 'commands', folder, file);
    const command = await import(pathToFileURL(filePath).href);
    if ('data' in command) {
      commands.push(command.data.toJSON());
      console.log(`  📦 Queued: /${command.data.name}`);
    }
  }
}

const token   = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error('❌ DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID must be set in .env');
  process.exit(1);
}

const rest = new REST().setToken(token);

try {
  console.log(`\n🚀 Registering ${commands.length} slash commands globally...`);
  const data = await rest.put(
    Routes.applicationCommands(clientId),
    { body: commands },
  );
  console.log(`✅ Successfully registered ${data.length} commands!`);
  console.log('\nCommands registered:');
  data.forEach(cmd => console.log(`  /${cmd.name}`));
} catch (err) {
  console.error('❌ Failed to register commands:', err);
}
