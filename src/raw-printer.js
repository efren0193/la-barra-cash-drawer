const { execFile } = require("node:child_process");
const path = require("node:path");

function runPowerShell(script, args = []) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, ...args],
      { windowsHide: true, timeout: 15000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || error.message).trim()));
          return;
        }
        resolve(stdout.trim());
      }
    );
  });
}

function scriptPath(name) {
  return path.join(__dirname, "powershell", name);
}

async function getPrinters() {
  if (process.platform !== "win32") return [];
  const output = await runPowerShell(scriptPath("get-printers.ps1"));
  if (!output) return [];
  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function getPrinterStatus(printerName) {
  const printers = await getPrinters();
  const printer = printers.find((item) => item.name === printerName);
  return printer || { name: printerName, installed: false, status: "No instalada", portName: "" };
}

async function openDrawer(config) {
  if (process.platform !== "win32") {
    throw new Error("La apertura física solo está disponible en Windows.");
  }

  const pin = config.drawerPin === 1 ? 1 : 0;
  const onUnits = Math.max(1, Math.min(255, Math.round(config.pulseOnMs / 2)));
  const offUnits = Math.max(1, Math.min(255, Math.round(config.pulseOffMs / 2)));
  const bytes = Buffer.from([0x1b, 0x70, pin, onUnits, offUnits]).toString("base64");
  await runPowerShell(scriptPath("send-raw.ps1"), [config.printerName, bytes, "La Barra - Abrir caja"]);
  return { success: true, printerName: config.printerName };
}

module.exports = { getPrinters, getPrinterStatus, openDrawer };
