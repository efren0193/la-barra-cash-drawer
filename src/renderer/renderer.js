const $ = (id) => document.getElementById(id);
let currentState;

function toast(message) {
  const element = $("toast");
  element.textContent = message;
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 3200);
}

function eventRow(item) {
  const li = document.createElement("li");
  li.className = item.type || "info";
  li.textContent = `${new Date(item.timestamp).toLocaleTimeString()} — ${item.message}`;
  return li;
}

function addEvent(item) {
  const list = $("events");
  list.querySelector(".empty")?.remove();
  list.prepend(eventRow(item));
}

async function loadPrinters(selected) {
  const result = await window.cashDrawer.getPrinters();
  const select = $("printerSelect");
  select.innerHTML = "";
  const printers = result.printers || [];
  if (!printers.some((printer) => printer.name === selected)) printers.unshift({ name:selected, portName:"" });
  printers.forEach((printer) => {
    const option = document.createElement("option");
    option.value = printer.name;
    option.textContent = `${printer.name}${printer.portName ? ` — ${printer.portName}` : ""}`;
    option.selected = printer.name === selected;
    select.append(option);
  });
  if (!result.success) toast(result.error);
}

function render(state) {
  currentState = state;
  const { config, printer } = state;
  $("printerName").textContent = printer.name;
  $("printerStatus").textContent = printer.status;
  $("printerPort").textContent = printer.portName || "No detectado";
  $("apiUrl").textContent = state.apiUrl;
  $("serviceBadge").textContent = "Servicio activo";
  $("serviceBadge").classList.add("online");
  $("apiPort").value = config.port;
  $("drawerPin").value = String(config.drawerPin);
  $("allowedOrigins").value = config.allowedOrigins.join("\n");
  $("autoStart").checked = config.autoStart;
  $("startMinimized").checked = config.startMinimized;
  $("token").value = config.token;
  const list = $("events");
  list.innerHTML = "";
  if (!state.events.length) list.innerHTML = '<li class="empty">Aún no hay actividad.</li>';
  state.events.slice().reverse().forEach(addEvent);
}

$("testButton").addEventListener("click", async () => {
  $("testButton").disabled = true;
  const result = await window.cashDrawer.testDrawer();
  toast(result.success ? "Pulso enviado. El cajón debe abrirse." : result.error);
  $("testButton").disabled = false;
});

$("saveButton").addEventListener("click", async () => {
  const settings = {
    printerName: $("printerSelect").value,
    port: Number($("apiPort").value),
    drawerPin: Number($("drawerPin").value),
    allowedOrigins: $("allowedOrigins").value.split(/\r?\n|,/).map((v) => v.trim().replace(/\/$/, "")).filter(Boolean),
    autoStart: $("autoStart").checked,
    startMinimized: $("startMinimized").checked
  };
  try { render(await window.cashDrawer.saveSettings(settings)); toast("Configuración guardada"); }
  catch (error) { toast(error.message); }
});

$("refreshButton").addEventListener("click", () => loadPrinters($("printerSelect").value));
$("copyToken").addEventListener("click", async () => { await navigator.clipboard.writeText($("token").value); toast("Token copiado"); });
$("newToken").addEventListener("click", async () => { $("token").value = await window.cashDrawer.regenerateToken(); toast("Token regenerado; actualízalo también en el POS"); });
window.cashDrawer.onEvent(addEvent);

(async () => {
  const state = await window.cashDrawer.getState();
  render(state);
  await loadPrinters(state.config.printerName);
})();
