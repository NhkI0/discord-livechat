# Discord Livechat Client

Client component that displays Discord media as a transparent overlay.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure server URL:**

   Edit `config.js`:
   ```javascript
   window.WEBSOCKET_SERVER_URL = 'ws://your-server-ip:8080';
   ```

3. **Build and run:**
   ```bash
   npm start
   ```

## Configuration

### Server Connection

Edit `config.js` to point to your server:

```javascript
// Local server (testing)
window.WEBSOCKET_SERVER_URL = 'ws://localhost:8080';

// Remote VPS server
window.WEBSOCKET_SERVER_URL = 'ws://123.45.67.89:8080';

// Domain name
window.WEBSOCKET_SERVER_URL = 'ws://livechat.yourdomain.com:8080';

// Secure WebSocket (with SSL)
window.WEBSOCKET_SERVER_URL = 'wss://livechat.yourdomain.com';
```

### Display Settings

Edit `src/renderer/renderer.ts` to customize:

```typescript
// Image display duration (milliseconds)
private readonly IMAGE_DISPLAY_DURATION = 6000; // 6 seconds

// Text font size (in CSS)
font-size: 3em;  // In src/renderer/index.html
```

## Scripts

- `npm start` - Build and run in development mode
- `npm run build` - Compile TypeScript
- `npm run dev` - Development mode with auto-reload
- `npm run pack` - Package app (no installer)
- `npm run dist` - Build installer for distribution

## Building Installers

```bash
npm run dist
```

Output will be in `release/` folder:
- **Windows:** `.exe` installer
- **macOS:** `.dmg` disk image
- **Linux:** `.AppImage` and `.deb` packages

## Features

- **Transparent overlay** - Floats above all windows
- **Click-through** - Interact with apps behind it
- **Auto-hide** - Images: 6 seconds, Videos: until end
- **Text support** - Impact font with black borders
- **Auto-reconnect** - Reconnects if connection is lost

## Window Properties

The client creates a borderless, transparent, always-on-top window:
- No frame or title bar
- Transparent background
- Always on top of other windows
- Click-through (except on media)
- Not shown in taskbar

## Troubleshooting

### Can't Connect to Server

1. Check `config.js` has correct server address
2. Verify server is running
3. Check firewall allows port 8080
4. Open DevTools (uncomment in `src/main.ts`) to see errors

### Media Not Displaying

1. Open DevTools: Uncomment this line in `src/main.ts`:
   ```typescript
   mainWindow.webContents.openDevTools();
   ```
2. Check console for errors
3. Verify WebSocket shows "Connected"

### Overlay Not Transparent

- Rebuild the app: `npm run dist`
- Don't have DevTools open (makes window opaque)

## Development

Enable DevTools for debugging:

Edit `src/main.ts`, uncomment:
```typescript
mainWindow.webContents.openDevTools();
```

Then run:
```bash
npm start
```

## Requirements

- Node.js v18 or higher
- Network access to WebSocket server
- Windows 10+, macOS 10.13+, or Linux with X11/Wayland

## For Streamers

Perfect for OBS overlays:
1. Run the client app
2. The transparent window can be captured by OBS
3. Use Window Capture source
4. Media appears only when sent to Discord

Or capture specific window/region containing the overlay.
