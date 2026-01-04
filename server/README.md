# Discord Livechat Server

Server component that runs on a VPS to monitor Discord and broadcast media via WebSocket.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Discord bot token and channel ID
   ```

3. **Build and run:**
   ```bash
   npm run build
   npm start
   ```

## Environment Variables

Create a `.env` file with:

```env
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CHANNEL_ID=your_channel_id_here
WEBSOCKET_PORT=8080
```

## Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the server
- `npm run dev` - Development mode with auto-reload

## Production Deployment

**Recommended:** Use PM2 for process management:
```bash
npm install -g pm2
pm2 start dist/server.js --name discord-livechat
pm2 save
pm2 startup
```

## Architecture

- `src/bot/discord-client.ts` - Discord bot that monitors channel
- `src/websocket/websocket-server.ts` - WebSocket server for broadcasting
- `src/server.ts` - Main entry point

## Ports

Default WebSocket port: **8080**

Make sure this port is open in your firewall!

## Logs

The server outputs logs to console showing:
- Discord bot connection status
- WebSocket client connections
- Media broadcasts

## Requirements

- Node.js v18 or higher
- Discord bot with MESSAGE CONTENT intent enabled
- Open port for WebSocket (default 8080)
