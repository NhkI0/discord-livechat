import { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut, ipcMain, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { SettingsManager, type MediaRegionSettings } from './settings-manager';

let overlayWindows: BrowserWindow[] = [];
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let settingsManager: SettingsManager;
let isEditMode = false;

let mainWs: WebSocket | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

function readWsUrl(): string {
  const defaultUrl = 'ws://localhost:8080';
  try {
    const configPath = path.join(__dirname, '../config.js');
    const content = fs.readFileSync(configPath, 'utf8');
    const match = content.match(/^\s*window\.WEBSOCKET_SERVER_URL\s*=\s*['"]([^'"]+)['"]/m);
    if (match) return match[1];
  } catch (err) {
    console.error('Failed to read WS URL from config.js:', err);
  }
  return defaultUrl;
}

function connectMainWebSocket(): void {
  const url = readWsUrl();
  console.log(`Main process connecting to WebSocket: ${url}`);

  mainWs = new WebSocket(url);

  mainWs.onopen = () => {
    console.log('Main process WebSocket connected');
  };

  mainWs.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data as string);
      broadcastToOverlays('media-message', message);
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  };

  mainWs.onerror = (error) => {
    console.error('Main process WebSocket error:', error);
  };

  mainWs.onclose = () => {
    console.log('Main process WebSocket disconnected, reconnecting in 3s...');
    mainWs = null;
    wsReconnectTimer = setTimeout(() => connectMainWebSocket(), 3000);
  };
}

const editState = {
  dragging: false,
  resizing: false,
  handle: '',
  startMouseX: 0,
  startMouseY: 0,
  startRegion: { x: 0, y: 0, width: 0, height: 0 } as MediaRegionSettings,
  currentRegion: { x: 0, y: 0, width: 0, height: 0 } as MediaRegionSettings,
};

const SNAP_THRESHOLD = 20;

function snapToNearest(value: number, targets: number[]): number {
  let closest = value;
  let minDist = SNAP_THRESHOLD;
  for (const t of targets) {
    const dist = Math.abs(value - t);
    if (dist < minDist) {
      minDist = dist;
      closest = t;
    }
  }
  return closest;
}

function getSnapEdges() {
  const xEdges: number[] = [];
  const yEdges: number[] = [];
  for (const d of screen.getAllDisplays()) {
    xEdges.push(d.bounds.x, d.bounds.x + d.bounds.width);
    yEdges.push(d.bounds.y, d.bounds.y + d.bounds.height);
  }
  return { xEdges, yEdges };
}

function createOverlayWindows() {
  const displays = screen.getAllDisplays();

  for (const display of displays) {
    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      focusable: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // Pass display bounds as query params so the renderer knows its offset
    win.loadFile(path.join(__dirname, '../src/renderer/index.html'), {
      query: {
        dx: String(display.bounds.x),
        dy: String(display.bounds.y),
        dw: String(display.bounds.width),
        dh: String(display.bounds.height),
      },
    });

    win.setIgnoreMouseEvents(true, { forward: true });

    win.on('closed', () => {
      overlayWindows = overlayWindows.filter(w => w !== win);
    });

    overlayWindows.push(win);
  }
}

function broadcastToOverlays(channel: string, ...args: any[]) {
  for (const win of overlayWindows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  }
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 400,
    height: 380,
    resizable: false,
    frame: true,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  settingsWindow.loadFile(path.join(__dirname, '../src/renderer/settings-window.html'));
  settingsWindow.setMenuBarVisibility(false);

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function broadcastSettingsChanged() {
  const settings = settingsManager.getSettings();
  broadcastToOverlays('media-settings-changed', settings);
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('media-settings-changed', settings);
  }
}

function enterEditMode() {
  if (isEditMode) return;
  isEditMode = true;
  editState.currentRegion = { ...settingsManager.getSettings() };
  editState.dragging = false;
  editState.resizing = false;

  for (const win of overlayWindows) {
    if (!win.isDestroyed()) {
      win.setIgnoreMouseEvents(false);
      win.setFocusable(true);
      win.webContents.send('enter-edit-mode', editState.currentRegion);
    }
  }
}

function exitEditMode() {
  isEditMode = false;
  editState.dragging = false;
  editState.resizing = false;

  for (const win of overlayWindows) {
    if (!win.isDestroyed()) {
      win.setIgnoreMouseEvents(true, { forward: true });
      win.setFocusable(false);
    }
  }
  broadcastToOverlays('exit-edit-mode');
}

function handleEditMouseDown(screenX: number, screenY: number, action: string, handle: string) {
  if (action === 'drag') {
    editState.dragging = true;
  } else if (action === 'resize') {
    editState.resizing = true;
    editState.handle = handle;
  }
  editState.startMouseX = screenX;
  editState.startMouseY = screenY;
  editState.startRegion = { ...editState.currentRegion };
}

function handleEditMouseMove(screenX: number, screenY: number) {
  if (!editState.dragging && !editState.resizing) return;

  const dx = screenX - editState.startMouseX;
  const dy = screenY - editState.startMouseY;
  const s = editState.startRegion;
  const MIN_SIZE = 50;
  const { xEdges, yEdges } = getSnapEdges();

  if (editState.dragging) {
    let rawX = s.x + dx;
    let rawY = s.y + dy;
    const w = editState.currentRegion.width;
    const h = editState.currentRegion.height;

    const snappedLeft = snapToNearest(rawX, xEdges);
    if (snappedLeft !== rawX) {
      rawX = snappedLeft;
    } else {
      const snappedRight = snapToNearest(rawX + w, xEdges);
      if (snappedRight !== rawX + w) rawX = snappedRight - w;
    }

    const snappedTop = snapToNearest(rawY, yEdges);
    if (snappedTop !== rawY) {
      rawY = snappedTop;
    } else {
      const snappedBottom = snapToNearest(rawY + h, yEdges);
      if (snappedBottom !== rawY + h) rawY = snappedBottom - h;
    }

    editState.currentRegion.x = rawX;
    editState.currentRegion.y = rawY;
  }

  if (editState.resizing) {
    switch (editState.handle) {
      case 'se': {
        let newW = Math.max(MIN_SIZE, s.width + dx);
        let newH = Math.max(MIN_SIZE, s.height + dy);
        const snR = snapToNearest(s.x + newW, xEdges);
        newW = snR - s.x;
        const snB = snapToNearest(s.y + newH, yEdges);
        newH = snB - s.y;
        editState.currentRegion.width = Math.max(MIN_SIZE, newW);
        editState.currentRegion.height = Math.max(MIN_SIZE, newH);
        break;
      }
      case 'sw': {
        let newW = Math.max(MIN_SIZE, s.width - dx);
        let newX = s.x + (s.width - newW);
        let newH = Math.max(MIN_SIZE, s.height + dy);
        newX = snapToNearest(newX, xEdges);
        newW = s.x + s.width - newX;
        const snB = snapToNearest(s.y + newH, yEdges);
        newH = snB - s.y;
        editState.currentRegion.x = newX;
        editState.currentRegion.width = Math.max(MIN_SIZE, newW);
        editState.currentRegion.height = Math.max(MIN_SIZE, newH);
        break;
      }
      case 'ne': {
        let newW = Math.max(MIN_SIZE, s.width + dx);
        let newH = Math.max(MIN_SIZE, s.height - dy);
        let newY = s.y + (s.height - newH);
        const snR = snapToNearest(s.x + newW, xEdges);
        newW = snR - s.x;
        newY = snapToNearest(newY, yEdges);
        newH = s.y + s.height - newY;
        editState.currentRegion.y = newY;
        editState.currentRegion.width = Math.max(MIN_SIZE, newW);
        editState.currentRegion.height = Math.max(MIN_SIZE, newH);
        break;
      }
      case 'nw': {
        let newW = Math.max(MIN_SIZE, s.width - dx);
        let newX = s.x + (s.width - newW);
        let newH = Math.max(MIN_SIZE, s.height - dy);
        let newY = s.y + (s.height - newH);
        newX = snapToNearest(newX, xEdges);
        newW = s.x + s.width - newX;
        newY = snapToNearest(newY, yEdges);
        newH = s.y + s.height - newY;
        editState.currentRegion.x = newX;
        editState.currentRegion.y = newY;
        editState.currentRegion.width = Math.max(MIN_SIZE, newW);
        editState.currentRegion.height = Math.max(MIN_SIZE, newH);
        break;
      }
    }
  }

  broadcastToOverlays('update-edit-region', editState.currentRegion);
}

function handleEditMouseUp() {
  editState.dragging = false;
  editState.resizing = false;
}

function finishEditMode() {
  const rounded: MediaRegionSettings = {
    x: Math.round(editState.currentRegion.x),
    y: Math.round(editState.currentRegion.y),
    width: Math.round(editState.currentRegion.width),
    height: Math.round(editState.currentRegion.height),
  };
  settingsManager.saveSettings(rounded);
  broadcastSettingsChanged();
  exitEditMode();
}

function registerIpcHandlers() {
  ipcMain.handle('get-media-settings', () => settingsManager.getSettings());

  ipcMain.handle('get-display-bounds', () => {
    return screen.getAllDisplays().map(d => ({
      x: d.bounds.x, y: d.bounds.y,
      width: d.bounds.width, height: d.bounds.height,
    }));
  });

  ipcMain.handle('save-media-settings', (_event, settings: MediaRegionSettings) => {
    settingsManager.saveSettings(settings);
    broadcastSettingsChanged();
  });

  ipcMain.handle('reset-media-settings', () => {
    settingsManager.resetToDefault();
    broadcastSettingsChanged();
  });

  ipcMain.on('request-edit-mode', () => enterEditMode());

  ipcMain.on('exit-edit-mode', () => exitEditMode());

  // Edit mode mouse events (from any overlay window, in screen-absolute coords)
  ipcMain.on('edit-mouse-down', (_event, data: { screenX: number; screenY: number; action: string; handle: string }) => {
    handleEditMouseDown(data.screenX, data.screenY, data.action, data.handle);
  });

  ipcMain.on('edit-mouse-move', (_event, data: { screenX: number; screenY: number }) => {
    handleEditMouseMove(data.screenX, data.screenY);
  });

  ipcMain.on('edit-mouse-up', () => handleEditMouseUp());

  ipcMain.on('finish-edit-mode', () => finishEditMode());

  // Forward media-done acks from the owner overlay renderer to the server so it
  // can release the next queued item.
  ipcMain.on('media-done', (_event, id: number | null) => {
    if (mainWs && mainWs.readyState === WebSocket.OPEN) {
      mainWs.send(JSON.stringify({ type: 'media-done', id }));
    }
  });
}


function createTray() {
  let iconPath: string;

  if (app.isPackaged) {
    iconPath = path.join(process.resourcesPath, 'assets', 'tray-icon.png');
  } else {
    iconPath = path.join(__dirname, '../assets/tray-icon.png');
  }

  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      console.warn('Tray icon not found at:', iconPath);
      trayIcon = nativeImage.createEmpty();
    }
  } catch (err) {
    console.error('Error loading tray icon:', err);
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Discord Livechat Client');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Skip Current Media (PageDown/Insert)',
      click: () => {
        console.log('Skip media clicked from tray menu');
        broadcastToOverlays('skip-media');
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Media Position Settings',
      click: () => {
        createSettingsWindow();
      }
    },
    {
      label: 'Edit Media Position',
      click: () => {
        enterEditMode();
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Show Window',
      click: () => {
        for (const win of overlayWindows) {
          if (!win.isDestroyed()) win.show();
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Exit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    for (const win of overlayWindows) {
      if (!win.isDestroyed()) {
        win.isVisible() ? win.hide() : win.show();
      }
    }
  });
}

function registerGlobalShortcuts() {
  const shortcuts = [
    { key: 'PageDown', name: 'PageDown' },
    { key: 'Insert', name: 'Insert' }
  ];

  const registered: string[] = [];
  const failed: string[] = [];

  shortcuts.forEach(({ key, name }) => {
    const success = globalShortcut.register(key, () => {
      console.log(`Global shortcut triggered: ${name} - skipping media`);
      broadcastToOverlays('skip-media');
    });

    if (success) {
      registered.push(name);
    } else {
      failed.push(name);
      console.error(`Failed to register global shortcut: ${name}`);
    }
  });

  if (registered.length > 0) {
    console.log(`Global keyboard shortcuts registered: ${registered.join(', ')}`);
  }
  if (failed.length > 0) {
    console.warn(`Failed to register: ${failed.join(', ')}`);
  }
}

app.on('ready', () => {
  settingsManager = new SettingsManager();
  registerIpcHandlers();
  createOverlayWindows();
  createTray();
  registerGlobalShortcuts();
  connectMainWebSocket();
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (overlayWindows.length === 0) {
    createOverlayWindows();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();

  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }
  if (mainWs) {
    mainWs.close();
    mainWs = null;
  }

  if (tray) {
    tray.destroy();
    tray = null;
  }
});
