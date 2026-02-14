import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getMediaSettings: () => ipcRenderer.invoke('get-media-settings'),
  saveMediaSettings: (settings: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke('save-media-settings', settings),
  requestEditMode: () => ipcRenderer.send('request-edit-mode'),
  resetMediaSettings: () => ipcRenderer.invoke('reset-media-settings'),
  onMediaSettingsChanged: (callback: (settings: { x: number; y: number; width: number; height: number }) => void) => {
    ipcRenderer.on('media-settings-changed', (_event, settings) => callback(settings));
  },
});
