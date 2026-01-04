import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { DiscordBot } from './bot/discord-client';
import { LivechatWebSocketServer } from './server/websocket-server';

dotenv.config();

let mainWindow: BrowserWindow | null = null;
let discordBot: DiscordBot | null = null;
let wsServer: LivechatWebSocketServer | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../src/renderer/index.html'));
  // mainWindow.webContents.openDevTools(); // Remove in production

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackendServices() {
  const botToken = process.env.DISCORD_BOT_TOKEN || '';
  const channelId = process.env.DISCORD_CHANNEL_ID || '';
  const wsPort = parseInt(process.env.WEBSOCKET_PORT || '8080', 10);

  // Start WebSocket server
  wsServer = new LivechatWebSocketServer(wsPort);

  // Start Discord bot
  discordBot = new DiscordBot(botToken, channelId);
  discordBot.onMedia((message) => {
    wsServer?.broadcast(message);
  });
}

app.on('ready', () => {
  createWindow();
  startBackendServices();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    discordBot?.disconnect();
    wsServer?.close();
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers for settings, etc.
ipcMain.handle('get-config', async () => {
  return {
    channelId: process.env.DISCORD_CHANNEL_ID,
    wsPort: process.env.WEBSOCKET_PORT,
  };
});
