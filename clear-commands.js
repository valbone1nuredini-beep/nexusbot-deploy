// Run once to wipe all registered slash commands: node clear-commands.js
import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error('❌ DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID must be set');
  process.exit(1);
}

const rest = new REST().setToken(token);

console.log('🗑️  Clearing ALL global slash commands...');
await rest.put(Routes.applicationCommands(clientId), { body: [] });
console.log('✅ All global commands cleared!');
console.log('Now run: node deploy-commands.js to re-register them clean.');
