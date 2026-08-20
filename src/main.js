const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
} = require("electron");

const crypto = require("node:crypto");
const path = require("node:path");

const {
  loadConfig,
  saveConfig,
} = require("./config");

const {
  getPrinters,
  getPrinterStatus,
  openDrawer,
  printTicket,
} = require("./raw-printer");

const {
  createLocalServer,
} = require("./server");

let mainWindow;
let tray;
let config;
let localServer;

let quitting = false;

const events = [];

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

/*
|--------------------------------------------------------------------------
| EVENTS
|--------------------------------------------------------------------------
*/

function addEvent(
  message,
  type = "info"
) {
  const item = {
    message,
    type,
    timestamp:
      new Date().toISOString(),
  };

  events.unshift(item);

  // Máximo 30 eventos
  events.splice(30);

  mainWindow?.webContents.send(
    "service:event",
    item
  );
}

/*
|--------------------------------------------------------------------------
| WINDOW
|--------------------------------------------------------------------------
*/

function createWindow() {
  mainWindow =
    new BrowserWindow({
      width: 900,
      height: 680,

      minWidth: 760,
      minHeight: 590,

      show: false,

      title:
        "La Barra Caja",

      backgroundColor:
        "#0b1020",

      webPreferences: {
        preload:
          path.join(
            __dirname,
            "preload.js"
          ),

        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

  mainWindow.setMenuBarVisibility(
    false
  );

  mainWindow.loadFile(
    path.join(
      __dirname,
      "renderer",
      "index.html"
    )
  );

  mainWindow.once(
    "ready-to-show",
    () => {
      if (
        !config.startMinimized ||
        process.argv.includes(
          "--show"
        )
      ) {
        mainWindow.show();
      }
    }
  );

  mainWindow.on(
    "close",
    (event) => {
      if (!quitting) {
        event.preventDefault();
        mainWindow.hide();
      }
    }
  );
}

/*
|--------------------------------------------------------------------------
| TRAY
|--------------------------------------------------------------------------
*/

function trayImage() {
  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
    >
      <rect
        width="64"
        height="64"
        rx="14"
        fill="#f59e0b"
      />

      <path
        d="M14 25h36v25H14z"
        fill="#111827"
      />

      <path
        d="M19 14h26v15H19z"
        fill="#fff"
      />

      <circle
        cx="43"
        cy="37"
        r="3"
        fill="#22c55e"
      />
    </svg>
  `;

  return nativeImage
    .createFromDataURL(
      `data:image/svg+xml;base64,${
        Buffer.from(svg).toString(
          "base64"
        )
      }`
    )
    .resize({
      width: 32,
      height: 32,
    });
}

function createTray() {
  tray =
    new Tray(
      trayImage()
    );

  tray.setToolTip(
    "La Barra Caja"
  );

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label:
          "Abrir La Barra Caja",

        click: () => {
          mainWindow.show();
          mainWindow.focus();
        },
      },

      {
        label:
          "Probar apertura",

        click: () =>
          testDrawer(),
      },

      {
        type:
          "separator",
      },

      {
        label:
          "Salir",

        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ])
  );

  tray.on(
    "double-click",
    () => {
      mainWindow.show();
      mainWindow.focus();
    }
  );
}

/*
|--------------------------------------------------------------------------
| AUTO START
|--------------------------------------------------------------------------
*/

function applyAutoStart() {
  if (
    process.platform ===
      "win32" &&
    app.isPackaged
  ) {
    app.setLoginItemSettings({
      openAtLogin:
        config.autoStart,

      args: [
        "--hidden",
      ],
    });
  }
}

/*
|--------------------------------------------------------------------------
| STATE
|--------------------------------------------------------------------------
*/

async function state() {
  let printer;

  try {
    printer =
      await getPrinterStatus(
        config.printerName
      );
  } catch (error) {
    printer = {
      name:
        config.printerName,

      installed: false,

      status:
        error.message,
    };
  }

  return {
    config,
    printer,
    events,

    apiUrl:
      `http://127.0.0.1:${config.port}`,
  };
}

/*
|--------------------------------------------------------------------------
| TEST DRAWER
|--------------------------------------------------------------------------
*/

async function testDrawer() {
  try {
    const result =
      await openDrawer(
        config
      );

    addEvent(
      "Prueba de apertura enviada correctamente",
      "success"
    );

    return result;
  } catch (error) {
    addEvent(
      error.message,
      "error"
    );

    return {
      success: false,
      error:
        error.message,
    };
  }
}

/*
|--------------------------------------------------------------------------
| SERVER
|--------------------------------------------------------------------------
*/

async function restartServer() {
  if (localServer) {
    await localServer.stop();
  }

  localServer =
    createLocalServer({
      getConfig:
        () => config,

      getStatus:
        () =>
          getPrinterStatus(
            config.printerName
          ),

      /*
       * El server simplemente llama
       * openDrawer().
       *
       * main.js agrega la configuración.
       */
      openDrawer:
        () =>
          openDrawer(
            config
          ),

      /*
       * server.js recibe únicamente
       * la ORDER.
       *
       * Aquí agregamos config.
       */
      printTicket:
        (order) =>
          printTicket(
            config,
            order
          ),

      onEvent:
        addEvent,
    });

  await localServer.start();

  addEvent(
    `Servicio local activo en 127.0.0.1:${config.port}`,
    "success"
  );
}

/*
|--------------------------------------------------------------------------
| SINGLE INSTANCE
|--------------------------------------------------------------------------
*/

app.on(
  "second-instance",
  () => {
    mainWindow?.show();
    mainWindow?.focus();
  }
);

/*
|--------------------------------------------------------------------------
| APP READY
|--------------------------------------------------------------------------
*/

app.whenReady().then(
  async () => {
    config =
      loadConfig();

    createWindow();
    createTray();
    applyAutoStart();

    /*
    |--------------------------------------------------------------------------
    | IPC - STATE
    |--------------------------------------------------------------------------
    */

    ipcMain.handle(
      "state:get",
      state
    );

    /*
    |--------------------------------------------------------------------------
    | IPC - PRINTERS
    |--------------------------------------------------------------------------
    */

    ipcMain.handle(
      "printers:get",
      async () => {
        try {
          return {
            success: true,

            printers:
              await getPrinters(),
          };
        } catch (error) {
          return {
            success: false,

            error:
              error.message,

            printers: [],
          };
        }
      }
    );

    /*
    |--------------------------------------------------------------------------
    | IPC - DRAWER
    |--------------------------------------------------------------------------
    */

    ipcMain.handle(
      "drawer:test",
      testDrawer
    );

    /*
    |--------------------------------------------------------------------------
    | IPC - SETTINGS
    |--------------------------------------------------------------------------
    */

    ipcMain.handle(
      "settings:save",
      async (
        _event,
        settings
      ) => {
        config =
          saveConfig({
            ...config,
            ...settings,

            /*
             * Nunca permitimos
             * cambiar el token
             * desde settings.
             */
            token:
              config.token,
          });

        applyAutoStart();

        await restartServer();

        addEvent(
          "Configuración guardada",
          "success"
        );

        return state();
      }
    );

    /*
    |--------------------------------------------------------------------------
    | IPC - TOKEN
    |--------------------------------------------------------------------------
    */

    ipcMain.handle(
      "token:regenerate",
      async () => {
        config =
          saveConfig({
            ...config,

            token:
              crypto
                .randomBytes(
                  24
                )
                .toString(
                  "hex"
                ),
          });

        addEvent(
          "Token de acceso regenerado",
          "info"
        );

        return config.token;
      }
    );

    /*
    |--------------------------------------------------------------------------
    | START LOCAL SERVER
    |--------------------------------------------------------------------------
    */

    try {
      await restartServer();
    } catch (error) {
      addEvent(
        `No se pudo iniciar el servicio: ${error.message}`,
        "error"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| QUIT
|--------------------------------------------------------------------------
*/

app.on(
  "before-quit",
  () => {
    quitting = true;
  }
);

/*
 * No cerramos Electron al cerrar
 * la ventana porque queremos que
 * continúe activo en el tray.
 */
app.on(
  "window-all-closed",
  () => {}
);