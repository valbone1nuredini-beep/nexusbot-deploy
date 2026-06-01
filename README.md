# NexusBot — Discord Bot

A powerful Discord bot with moderation, welcome/goodbye messages, giveaways, tickets, applications, auto-responders, and custom commands.

## Features
- 🛡️ **Moderation** — ban, kick, mute, warn, purge, lock, slowmode, role management
- 👋 **Welcome/Goodbye** — custom messages with embeds
- 🎉 **Giveaways** *(Premium)* — start, end, reroll
- 🎫 **Tickets** *(Premium)* — full ticket system with categories
- 📋 **Applications** *(Premium)* — custom application forms

## Setup

### 1. Clone & install
```bash
git clone <your-repo>
cd nexusbot
npm install
```

### 2. Configure environment
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

Required variables:
- `DISCORD_BOT_TOKEN` — from Discord Developer Portal → Bot → Reset Token
- `DISCORD_CLIENT_ID` — your Application ID

### 3. Register slash commands
```bash
node bot/deploy-commands.js
```

### 4. Start the bot
```bash
node bot/index.js
```

## Deploy to Railway (24/7)
1. Push this folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add environment variables: `DISCORD_BOT_TOKEN` and `DISCORD_CLIENT_ID`
4. Railway auto-deploys and keeps the bot running 24/7

## Commands
| Command | Description | Premium |
|---------|-------------|---------|
| `/ban` | Ban a user | No |
| `/kick` | Kick a user | No |
| `/mute` | Timeout a user | No |
| `/warn` | Warn a user | No |
| `/purge` | Delete messages | No |
| `/role add` | Add a role to a user | No |
| `/role remove` | Remove a role from a user | No |
| `/welcome` | Configure welcome messages | No |
| `/goodbye` | Configure goodbye messages | No |
| `/giveaway` | Manage giveaways | Yes |
| `/ticket` | Manage ticket system | Yes |
| `/apply` | Manage applications | Yes |
