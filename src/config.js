const { app } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const defaults = {
  printerName: "Generic / Text Only",
  port: 17321,
  token: "",
  autoStart: true,
  startMinimized: true,
  drawerPin: 0,
  pulseOnMs: 50,
  pulseOffMs: 500,
  allowedOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"]
};

function configPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function normalize(value = {}) {
  return {
    ...defaults,
    ...value,
    port: Number(value.port || defaults.port),
    drawerPin: Number(value.drawerPin ?? defaults.drawerPin),
    pulseOnMs: Number(value.pulseOnMs || defaults.pulseOnMs),
    pulseOffMs: Number(value.pulseOffMs || defaults.pulseOffMs),
    allowedOrigins: Array.isArray(value.allowedOrigins)
      ? value.allowedOrigins.filter(Boolean)
      : defaults.allowedOrigins
  };
}

function loadConfig() {
  try {
    const saved = JSON.parse(fs.readFileSync(configPath(), "utf8"));
    const config = normalize(saved);
    if (!config.token) config.token = crypto.randomBytes(24).toString("hex");
    saveConfig(config);
    return config;
  } catch {
    const config = normalize({ token: crypto.randomBytes(24).toString("hex") });
    saveConfig(config);
    return config;
  }
}

function saveConfig(value) {
  const config = normalize(value);
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), "utf8");
  return config;
}

module.exports = { loadConfig, saveConfig };
