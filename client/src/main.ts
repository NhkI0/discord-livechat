import { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../src/renderer/index.html'));

  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // In development: __dirname is dist/, icon is at ../assets/tray-icon.png
  // In production: __dirname is resources/app.asar or resources/app/dist
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
        console.log('🎯 Skip media clicked from tray menu');
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('skip-media');
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Show Window',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
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
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
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
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('skip-media');
      }
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
  createWindow();
  createTray();
  registerGlobalShortcuts();
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();

  // Clean up tray
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
