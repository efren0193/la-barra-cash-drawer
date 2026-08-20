const { execFile } = require("node:child_process");
const path = require("node:path");
const { app } = require("electron");

const {
  buildTicketBuffer,
} = require("./tickets");

function runPowerShell(script, args = []) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        script,
        ...args,
      ],
      {
        windowsHide: true,
        timeout: 15000,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              (stderr || error.message).trim()
            )
          );

          return;
        }

        resolve(stdout.trim());
      }
    );
  });
}

function scriptPath(name) {
  return app.isPackaged
    ? path.join(
        process.resourcesPath,
        "powershell",
        name
      )
    : path.join(
        __dirname,
        "powershell",
        name
      );
}

/*
|--------------------------------------------------------------------------
| PRINTERS
|--------------------------------------------------------------------------
*/

async function getPrinters() {
  if (process.platform !== "win32") {
    return [];
  }

  const output = await runPowerShell(
    scriptPath("get-printers.ps1")
  );

  if (!output) return [];

  const parsed = JSON.parse(output);

  return Array.isArray(parsed)
    ? parsed
    : [parsed];
}

async function getPrinterStatus(printerName) {
  const printers = await getPrinters();

  const printer = printers.find(
    (item) => item.name === printerName
  );

  return (
    printer || {
      name: printerName,
      installed: false,
      status: "No instalada",
      portName: "",
    }
  );
}

/*
|--------------------------------------------------------------------------
| SEND RAW
|--------------------------------------------------------------------------
*/

async function sendRaw(
  printerName,
  buffer,
  documentName = "La Barra RAW"
) {
  if (process.platform !== "win32") {
    throw new Error(
      "La impresión RAW solo está disponible en Windows."
    );
  }

  if (!printerName) {
    throw new Error(
      "No hay una impresora configurada."
    );
  }

  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error(
      "El contenido RAW no es válido."
    );
  }

  const bytes = buffer.toString("base64");

  await runPowerShell(
    scriptPath("send-raw.ps1"),
    [
      printerName,
      bytes,
      documentName,
    ]
  );

  return {
    success: true,
    printerName,
  };
}

/*
|--------------------------------------------------------------------------
| CASH DRAWER
|--------------------------------------------------------------------------
*/

async function openDrawer(config) {
  if (!config?.printerName) {
    throw new Error(
      "No hay una impresora configurada."
    );
  }

  const pin =
    config.drawerPin === 1
      ? 1
      : 0;

  const onUnits = Math.max(
    1,
    Math.min(
      255,
      Math.round(
        Number(config.pulseOnMs || 50) / 2
      )
    )
  );

  const offUnits = Math.max(
    1,
    Math.min(
      255,
      Math.round(
        Number(config.pulseOffMs || 250) / 2
      )
    )
  );

  /*
   * ESC p m t1 t2
   *
   * ESC = 0x1B
   * p   = 0x70
   * m   = pin
   */
  const command = Buffer.from([
    0x1b,
    0x70,
    pin,
    onUnits,
    offUnits,
  ]);

  await sendRaw(
    config.printerName,
    command,
    "La Barra - Abrir caja"
  );

  return {
    success: true,
    printerName:
      config.printerName,
  };
}

/*
|--------------------------------------------------------------------------
| PRINT TICKET
|--------------------------------------------------------------------------
*/

async function printTicket(config, order) {
  if (!config?.printerName) {
    throw new Error(
      "No hay una impresora configurada."
    );
  }

  if (!order) {
    throw new Error(
      "La orden es requerida para imprimir."
    );
  }

  /*
   * tickets.js convierte la orden
   * al Buffer ESC/POS.
   */
  const ticketBuffer =
    buildTicketBuffer(order);

  if (
    !ticketBuffer ||
    !Buffer.isBuffer(ticketBuffer)
  ) {
    throw new Error(
      "No se pudo construir el ticket."
    );
  }

  await sendRaw(
    config.printerName,
    ticketBuffer,
    `La Barra - Ticket ${order.id || ""}`
  );

  return {
    success: true,
    printerName:
      config.printerName,
    orderId:
      order.id || null,
  };
}

module.exports = {
  getPrinters,
  getPrinterStatus,
  sendRaw,
  openDrawer,
  printTicket,
};