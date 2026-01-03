import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld('electronAPI', {
    getConfig: () => ipcRenderer.send('get-config'),
});
