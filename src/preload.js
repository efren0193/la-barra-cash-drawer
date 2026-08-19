const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cashDrawer", {
  getState: () => ipcRenderer.invoke("state:get"),
  getPrinters: () => ipcRenderer.invoke("printers:get"),
  testDrawer: () => ipcRenderer.invoke("drawer:test"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  regenerateToken: () => ipcRenderer.invoke("token:regenerate"),
  onEvent: (callback) => ipcRenderer.on("service:event", (_event, value) => callback(value))
});
