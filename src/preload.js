const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  loadData: () => ipcRenderer.sendSync('data:load'),
  saveData: (data) => ipcRenderer.sendSync('data:save', data),
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
  collapse: (value) => ipcRenderer.send('window:collapse', value),
  pin: (value) => ipcRenderer.invoke('window:pin', value)
});
