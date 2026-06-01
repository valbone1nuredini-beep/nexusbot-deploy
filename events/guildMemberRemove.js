// bot/events/guildMemberRemove.js — fires when a member leaves
import { Events, EmbedBuilder } from 'discord.js';
import { goodbyeConfig } from '../commands/welcome/goodbye.js';

export const name = Events.GuildMemberRemove;
export const once = false;

export async function execute(member) {
  const cfg = goodbyeConfig.get(member.guild.id);
  if (!cfg || !cfg.enabled || !cfg.channelId) return;

  const channel = member.guild.channels.cache.get(cfg.channelId);
  if (!channel) return;

  const msg = (cfg.message ?? 'Goodbye **{user}**, we hope to see you again!')
    .replace('{user}', member.user.tag)
    .replace('{server}', member.guild.name);

  const embed = new EmbedBuilder()
    .setColor(0xFF6600)
    .setDescription(msg)
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(console.error);
}
