// bot/events/guildMemberAdd.js — fires when a member joins
import { Events, EmbedBuilder } from 'discord.js';
import { welcomeConfig } from '../commands/welcome/welcome.js';

export const name = Events.GuildMemberAdd;
export const once = false;

export async function execute(member) {
  const cfg = welcomeConfig.get(member.guild.id);
  if (!cfg || !cfg.enabled || !cfg.channelId) return;

  const channel = member.guild.channels.cache.get(cfg.channelId);
  if (!channel) return;

  const msg = (cfg.message ?? 'Welcome to **{server}**, {user}! You are member #{count} 🎉')
    .replace('{user}', member.toString())
    .replace('{server}', member.guild.name)
    .replace('{count}', member.guild.memberCount);

  const embed = new EmbedBuilder()
    .setColor(cfg.embedColor ?? 0x5865F2)
    .setDescription(msg)
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(console.error);

  // Auto-role
  if (cfg.roleId) {
    const role = member.guild.roles.cache.get(cfg.roleId);
    if (role) await member.roles.add(role).catch(console.error);
  }
}
