import * as dotenv from 'dotenv';
import { DiscordBot } from './bot/discord-client';
import { LivechatWebSocketServer } from './websocket/websocket-server';

dotenv.config();

let discordBot: DiscordBot | null = null;
let wsServer: LivechatWebSocketServer | null = null;

function startServer() {
    const botToken = process.env.DISCORD_BOT_TOKEN || '';
    const channelId = process.env.DISCORD_CHANNEL_ID || '';
    const wsPort = parseInt(process.env.WEBSOCKET_PORT || '8080', 10);

    if (!botToken || !channelId) {
        console.error('❌ ERROR: Missing required environment variables!');
        console.error('Please set DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID in .env file');
        process.exit(1);
    }

    console.log('Starting Discord Livechat Server...\n');

    wsServer = new LivechatWebSocketServer(wsPort);

    discordBot = new DiscordBot(botToken, channelId);
    discordBot.onMedia((message) => {
        wsServer?.enqueue(message);
    });

    console.log('\n✅ Server is running!');
    console.log(`📡 WebSocket server: ws://localhost:${wsPort}`);
    console.log('🤖 Discord bot: Connected and monitoring channel\n');
}

process.on('SIGINT', () => {
    console.log('\n\nShutting down server...');
    discordBot?.disconnect();
    wsServer?.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\nShutting down server...');
    discordBot?.disconnect();
    wsServer?.close();
    process.exit(0);
});

startServer();
