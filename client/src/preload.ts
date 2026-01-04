import { contextBridge } from 'electron';

// Expose any APIs needed by the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Add any IPC methods here if needed
});
