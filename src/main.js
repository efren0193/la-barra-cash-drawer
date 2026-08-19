const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } = require("electron");
const crypto = require("node:crypto");
const path = require("node:path");
const { loadConfig, saveConfig } = require("./config");
const { getPrinters, getPrinterStatus, openDrawer } = require("./raw-printer");
const { createLocalServer } = require("./server");

let mainWindow;
let tray;
let config;
let localServer;
let quitting = false;
const events = [];

if (!app.requestSingleInstanceLock()) app.quit();

function addEvent(message, type = "info") {
  const item = { message, type, timestamp: new Date().toISOString() };
  events.unshift(item);
  events.splice(30);
  mainWindow?.webContents.send("service:event", item);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 760,
    minHeight: 590,
    show: false,
    title: "La Barra Caja",
    backgroundColor: "#0b1020",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.once("ready-to-show", () => {
    if (!config.startMinimized || process.argv.includes("--show")) mainWindow.show();
  });
  mainWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function trayImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="14" fill="#f59e0b"/><path d="M14 25h36v25H14z" fill="#111827"/><path d="M19 14h26v15H19z" fill="#fff"/><circle cx="43" cy="37" r="3" fill="#22c55e"/></svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`).resize({ width: 32, height: 32 });
}

function createTray() {
  tray = new Tray(trayImage());
  tray.setToolTip("La Barra Caja");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Abrir La Barra Caja", click: () => { mainWindow.show(); mainWindow.focus(); } },
    { label: "Probar apertura", click: () => testDrawer() },
    { type: "separator" },
    { label: "Salir", click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on("double-click", () => { mainWindow.show(); mainWindow.focus(); });
}

function applyAutoStart() {
  if (process.platform === "win32" && app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: config.autoStart, args: ["--hidden"] });
  }
}

async function state() {
  let printer;
  try { printer = await getPrinterStatus(config.printerName); }
  catch (error) { printer = { name: config.printerName, installed: false, status: error.message }; }
  return { config, printer, events, apiUrl: `http://127.0.0.1:${config.port}` };
}

async function testDrawer() {
  try {
    const result = await openDrawer(config);
    addEvent("Prueba de apertura enviada correctamente", "success");
    return result;
  } catch (error) {
    addEvent(error.message, "error");
    return { success: false, error: error.message };
  }
}

async function restartServer() {
  if (localServer) await localServer.stop();
  localServer = createLocalServer({
    getConfig: () => config,
    getStatus: () => getPrinterStatus(config.printerName),
    openDrawer: () => openDrawer(config),
    onEvent: addEvent
  });
  await localServer.start();
  addEvent(`Servicio local activo en 127.0.0.1:${config.port}`, "success");
}

app.on("second-instance", () => { mainWindow?.show(); mainWindow?.focus(); });

app.whenReady().then(async () => {
  config = loadConfig();
  createWindow();
  createTray();
  applyAutoStart();

  ipcMain.handle("state:get", state);
  ipcMain.handle("printers:get", async () => {
    try { return { success: true, printers: await getPrinters() }; }
    catch (error) { return { success: false, error: error.message, printers: [] }; }
  });
  ipcMain.handle("drawer:test", testDrawer);
  ipcMain.handle("settings:save", async (_event, settings) => {
    config = saveConfig({ ...config, ...settings, token: config.token });
    applyAutoStart();
    await restartServer();
    addEvent("Configuración guardada", "success");
    return state();
  });
  ipcMain.handle("token:regenerate", async () => {
    config = saveConfig({ ...config, token: crypto.randomBytes(24).toString("hex") });
    addEvent("Token de acceso regenerado", "info");
    return config.token;
  });

  try { await restartServer(); }
  catch (error) { addEvent(`No se pudo iniciar el servicio: ${error.message}`, "error"); }
});

app.on("before-quit", () => { quitting = true; });
app.on("window-all-closed", () => {});
