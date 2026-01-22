import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onSkipMedia: (callback: () => void) => {
    ipcRenderer.on('skip-media', callback);
  },
});
