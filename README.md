<div align="center">

# Discord Livechat

**Real-time Discord-to-desktop overlay for images, videos, and text.**

A Discord bot streams media from a channel over WebSocket to one or more Electron client overlays — perfect for community streams, events, or creative displays.

[![Node](https://img.shields.io/badge/node-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Electron](https://img.shields.io/badge/Electron-39-47848F?logo=electron&logoColor=white)](https://www.electronjs.org)
[![Discord.js](https://img.shields.io/badge/discord.js-14-5865F2?logo=discord&logoColor=white)](https://discord.js.org)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](#license)

</div>

---

## How it works

```
 ┌────────────────┐      ┌───────────────────┐      ┌────────────────────┐
 │  Discord       │ ───▶ │  server/          │ ─ws─▶│  client/           │
 │  channel       │      │  bot + WS relay   │      │  Electron overlay  │
 └────────────────┘      └───────────────────┘      └────────────────────┘
                                                       (one or many)
```

- **`server/`** — Discord.js bot + WebSocket relay. Run locally or on a VPS.
- **`client/`** — Electron app that connects to the server and displays incoming media as a transparent overlay.

## Features

- 🖼️ **Instant media**: images and videos appear the moment they're posted
- 💬 **Text overlays**: message text rendered alongside media
- 🌐 **Many clients**: one server can fan out to multiple overlay displays
- 🔌 **Auto-reconnect**: clients recover from network blips automatically
- 🖥️ **Cross-platform**: Windows, macOS, Linux installers via electron-builder

## Prerequisites

- Node.js **18+**
- A Discord bot token with the **Message Content Intent** enabled ([Developer Portal](https://discord.com/developers/applications))
- The bot invited to your server with read access to the target channel

## Quick start

### 1. Server

```bash
cd server
npm install
cp .env.example .env
```

Fill in `server/.env`:

```env
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CHANNEL_ID=your_channel_id
WEBSOCKET_PORT=8080
```

> 💡 To change which channel the bot watches, just update `DISCORD_CHANNEL_ID`.

Run:

```bash
npm start        # build + run
npm run dev      # auto-rebuild on changes
```

### 2. Client

```bash
cd client
npm install
```

Point the client at your server in `client/config.js`:

```js
window.WEBSOCKET_SERVER_URL = 'ws://localhost:8080';      // local
// window.WEBSOCKET_SERVER_URL = 'ws://your-vps-ip:8080'; // remote
```

Run:

```bash
npm start        # build + launch Electron
npm run dist     # produce an installer in release/
```

## Deploying the server on a VPS

The server is a plain Node process — any process manager works. With PM2:

```bash
npm install -g pm2
cd server && npm install && npm run build
pm2 start dist/server.js --name discord-livechat
pm2 save && pm2 startup
```

Open the WebSocket port in your firewall (`sudo ufw allow 8080/tcp`). For TLS, terminate `wss://` at an nginx reverse proxy and point the client at `wss://your-domain`.

## Project layout

```
discord-livechat/
├── server/
│   ├── src/
│   │   ├── bot/discord-client.ts
│   │   ├── websocket/websocket-server.ts
│   │   ├── types/index.ts
│   │   └── server.ts
│   └── .env.example
└── client/
    ├── src/
    │   ├── main.ts
    │   ├── preload.ts
    │   ├── settings-manager.ts
    │   └── renderer/
    └── config.js
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Bot doesn't connect | Check the token; enable **Message Content Intent**; confirm the bot is in the server. |
| Client receives nothing | Verify `config.js` URL, check the WebSocket port is reachable, open Electron DevTools for console errors. |
| Port already in use | Change `WEBSOCKET_PORT` in `server/.env` and the matching URL in `client/config.js`. |

## Contact

Contact me on Discord **@nhankio** for any other information.


