const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('shyldone', {
  getStatus: () => ipcRenderer.invoke('agent:status'),
  runScan: () => ipcRenderer.invoke('agent:scan'),
  onStatus: (callback) => ipcRenderer.on('agent:status-changed', (_event, value) => callback(value)),
});
