// bot/commands/moderation/role.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('role')
  .setDescription('Add or remove a role from a user')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommand(sub => sub
    .setName('add')
    .setDescription('Add a role to a user')
    .addUserOption(o => o.setName('user').setDescription('The user to give the role to').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('The role to add').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('remove')
    .setDescription('Remove a role from a user')
    .addUserOption(o => o.setName('user').setDescription('The user to remove the role from').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('The role to remove').setRequired(true)));

export async function execute(interaction) {
  const sub    = interaction.options.getSubcommand();
  const member = interaction.options.getMember('user');
  const role   = interaction.options.getRole('role');

  // Safety checks
  if (role.managed) {
    return interaction.reply({ content: '❌ That role is managed by an integration and cannot be assigned manually.', ephemeral: true });
  }
  if (role.id === interaction.guild.roles.everyone.id) {
    return interaction.reply({ content: '❌ You cannot assign the @everyone role.', ephemeral: true });
  }
  if (role.position >= interaction.guild.members.me.roles.highest.position) {
    return interaction.reply({ content: '❌ That role is higher than or equal to my highest role. Move my role above it first.', ephemeral: true });
  }

  if (sub === 'add') {
    if (member.roles.cache.has(role.id)) {
      return interaction.reply({ content: `❌ ${member} already has the ${role} role.`, ephemeral: true });
    }
    await member.roles.add(role);
    const embed = new EmbedBuilder()
      .setColor(0x00FF88)
      .setDescription(`✅ Added ${role} to ${member}`)
      .setFooter({ text: `Done by ${interaction.user.tag}` });
    await interaction.reply({ embeds: [embed] });

  } else if (sub === 'remove') {
    if (!member.roles.cache.has(role.id)) {
      return interaction.reply({ content: `❌ ${member} doesn't have the ${role} role.`, ephemeral: true });
    }
    await member.roles.remove(role);
    const embed = new EmbedBuilder()
      .setColor(0xFF6600)
      .setDescription(`✅ Removed ${role} from ${member}`)
      .setFooter({ text: `Done by ${interaction.user.tag}` });
    await interaction.reply({ embeds: [embed] });
  }
}
