// bot/events/ready.js
import { Events, ActivityType } from 'discord.js';

export const name  = Events.ClientReady;
export const once  = true;

export async function execute(client) {
  console.log(`\n✅ NexusBot is online as ${client.user.tag}`);
  console.log(`   Serving ${client.guilds.cache.size} server(s)`);

  client.user.setPresence({
    activities: [{ name: '/help | nexusbot.gg', type: ActivityType.Watching }],
    status: 'online',
  });
}
