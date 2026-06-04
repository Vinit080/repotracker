const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateAvailable: (callback) => ipcRenderer.once('update-available', (_event, value) => callback(value)),
  onUpdateDownloaded: (callback) => ipcRenderer.once('update-downloaded', (_event, value) => callback(value)),
  restartToUpdate: () => ipcRenderer.invoke('restart-to-update'),
  getLocalToken: () => ipcRenderer.invoke('get-local-token')
});
