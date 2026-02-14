import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onSkipMedia: (callback: () => void) => {
    ipcRenderer.on('skip-media', callback);
  },

  getMediaSettings: () => ipcRenderer.invoke('get-media-settings'),
  getDisplayBounds: () => ipcRenderer.invoke('get-display-bounds'),
  saveMediaSettings: (settings: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke('save-media-settings', settings),
  onMediaSettingsChanged: (callback: (settings: { x: number; y: number; width: number; height: number }) => void) => {
    ipcRenderer.on('media-settings-changed', (_event: any, settings: any) => callback(settings));
  },

  // Edit mode lifecycle
  onEnterEditMode: (callback: (region: { x: number; y: number; width: number; height: number }) => void) => {
    ipcRenderer.on('enter-edit-mode', (_event: any, region: any) => callback(region));
  },
  onExitEditMode: (callback: () => void) => {
    ipcRenderer.on('exit-edit-mode', callback);
  },
  onUpdateEditRegion: (callback: (region: { x: number; y: number; width: number; height: number }) => void) => {
    ipcRenderer.on('update-edit-region', (_event: any, region: any) => callback(region));
  },

  // Edit mode mouse events (renderer -> main, in screen-absolute coords)
  sendEditMouseDown: (data: { screenX: number; screenY: number; action: string; handle: string }) => {
    ipcRenderer.send('edit-mouse-down', data);
  },
  sendEditMouseMove: (data: { screenX: number; screenY: number }) => {
    ipcRenderer.send('edit-mouse-move', data);
  },
  sendEditMouseUp: () => {
    ipcRenderer.send('edit-mouse-up');
  },
  finishEditMode: () => {
    ipcRenderer.send('finish-edit-mode');
  },
});
