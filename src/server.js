const http = require("node:http");

function json(response, status, body, origin, config) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  };
  if (origin && config.allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }
  response.writeHead(status, headers);
  response.end(JSON.stringify(body));
}

function createLocalServer({ getConfig, getStatus, openDrawer, onEvent }) {
  let server;

  return {
    start() {
      const config = getConfig();
      server = http.createServer(async (request, response) => {
        const origin = request.headers.origin;
        if (origin && !config.allowedOrigins.includes(origin)) {
          return json(response, 403, { success: false, error: "Origen no autorizado" }, null, config);
        }

        if (request.method === "OPTIONS") {
          response.writeHead(204, {
            "Access-Control-Allow-Origin": origin || "",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-La-Barra-Token",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            Vary: "Origin"
          });
          return response.end();
        }

        if (request.url === "/health" && request.method === "GET") {
          try {
            return json(response, 200, { success: true, service: "La Barra Caja", printer: await getStatus() }, origin, config);
          } catch (error) {
            return json(response, 503, { success: false, error: error.message }, origin, config);
          }
        }

        if (request.url === "/drawer/open" && request.method === "POST") {
          const suppliedToken = request.headers["x-la-barra-token"] || request.headers.authorization?.replace(/^Bearer\s+/i, "");
          if (!suppliedToken || suppliedToken !== config.token) {
            onEvent("Solicitud rechazada: token incorrecto", "error");
            return json(response, 401, { success: false, error: "No autorizado" }, origin, config);
          }
          try {
            const result = await openDrawer();
            onEvent("Cajón abierto desde el POS", "success");
            return json(response, 200, result, origin, config);
          } catch (error) {
            onEvent(error.message, "error");
            return json(response, 500, { success: false, error: error.message }, origin, config);
          }
        }

        return json(response, 404, { success: false, error: "Ruta no encontrada" }, origin, config);
      });

      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(config.port, "127.0.0.1", resolve);
      });
    },
    stop() {
      return new Promise((resolve) => (server ? server.close(resolve) : resolve()));
    }
  };
}

module.exports = { createLocalServer };
