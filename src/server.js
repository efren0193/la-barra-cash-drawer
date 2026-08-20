const http = require("node:http");

function json(response, status, body, origin, config) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };

  if (origin && config.allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }

  response.writeHead(status, headers);
  response.end(JSON.stringify(body));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let finished = false;

    request.on("data", (chunk) => {
      if (finished) return;

      body += chunk;

      if (Buffer.byteLength(body, "utf8") > 1024 * 1024) {
        finished = true;
        reject(new Error("Payload demasiado grande"));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (finished) return;

      finished = true;

      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("JSON inválido"));
      }
    });

    request.on("error", (error) => {
      if (finished) return;

      finished = true;
      reject(error);
    });
  });
}

function getSuppliedToken(request) {
  return (
    request.headers["x-la-barra-token"] ||
    request.headers.authorization?.replace(/^Bearer\s+/i, "")
  );
}

function isAuthorized(request, config) {
  const suppliedToken = getSuppliedToken(request);

  return Boolean(
    suppliedToken &&
    suppliedToken === config.token
  );
}

function createLocalServer({
  getConfig,
  getStatus,
  openDrawer,
  printTicket,
  onEvent,
}) {
  let server;

  return {
    start() {
      const config = getConfig();

      server = http.createServer(async (request, response) => {
        const origin = request.headers.origin;

        /*
        |--------------------------------------------------------------------------
        | ORIGIN
        |--------------------------------------------------------------------------
        */

        if (
          origin &&
          !config.allowedOrigins.includes(origin)
        ) {
          return json(
            response,
            403,
            {
              success: false,
              error: "Origen no autorizado",
            },
            null,
            config
          );
        }

        /*
        |--------------------------------------------------------------------------
        | CORS PREFLIGHT
        |--------------------------------------------------------------------------
        */

        if (request.method === "OPTIONS") {
          response.writeHead(204, {
            "Access-Control-Allow-Origin": origin || "",
            "Access-Control-Allow-Headers":
              "Content-Type, Authorization, X-La-Barra-Token",
            "Access-Control-Allow-Methods":
              "GET, POST, OPTIONS",
            Vary: "Origin",
          });

          return response.end();
        }

        /*
        |--------------------------------------------------------------------------
        | HEALTH
        |--------------------------------------------------------------------------
        */

        if (
          request.url === "/health" &&
          request.method === "GET"
        ) {
          try {
            return json(
              response,
              200,
              {
                success: true,
                service: "La Barra Caja",
                printer: await getStatus(),
              },
              origin,
              config
            );
          } catch (error) {
            return json(
              response,
              503,
              {
                success: false,
                error: error.message,
              },
              origin,
              config
            );
          }
        }

        /*
        |--------------------------------------------------------------------------
        | ABRIR CAJÓN
        |--------------------------------------------------------------------------
        */

        if (
          request.url === "/drawer/open" &&
          request.method === "POST"
        ) {
          if (!isAuthorized(request, config)) {
            onEvent(
              "Solicitud rechazada: token incorrecto",
              "error"
            );

            return json(
              response,
              401,
              {
                success: false,
                error: "No autorizado",
              },
              origin,
              config
            );
          }

          try {
            const result =
              await openDrawer();

            onEvent(
              "Cajón abierto desde el POS",
              "success"
            );

            return json(
              response,
              200,
              result,
              origin,
              config
            );
          } catch (error) {
            onEvent(
              error.message,
              "error"
            );

            return json(
              response,
              500,
              {
                success: false,
                error: error.message,
              },
              origin,
              config
            );
          }
        }

        /*
        |--------------------------------------------------------------------------
        | IMPRIMIR TICKET
        |--------------------------------------------------------------------------
        */

        if (
          request.url === "/printer/ticket" &&
          request.method === "POST"
        ) {
          if (!isAuthorized(request, config)) {
            onEvent(
              "Impresión rechazada: token incorrecto",
              "error"
            );

            return json(
              response,
              401,
              {
                success: false,
                error: "No autorizado",
              },
              origin,
              config
            );
          }

          try {
            const body =
              await readJsonBody(request);

            const { order } = body;

            if (!order) {
              return json(
                response,
                400,
                {
                  success: false,
                  error:
                    "La orden es requerida",
                },
                origin,
                config
              );
            }

            const result =
              await printTicket(order);

            onEvent(
              `Ticket impreso: pedido ${order.id}`,
              "success"
            );

            return json(
              response,
              200,
              {
                success: true,
                data: result,
              },
              origin,
              config
            );
          } catch (error) {
            onEvent(
              error.message,
              "error"
            );

            return json(
              response,
              500,
              {
                success: false,
                error:
                  error.message ||
                  "No se pudo imprimir el ticket",
              },
              origin,
              config
            );
          }
        }

        /*
        |--------------------------------------------------------------------------
        | 404
        |--------------------------------------------------------------------------
        */

        return json(
          response,
          404,
          {
            success: false,
            error:
              "Ruta no encontrada",
          },
          origin,
          config
        );
      });

      return new Promise(
        (resolve, reject) => {
          server.once(
            "error",
            reject
          );

          server.listen(
            config.port,
            "127.0.0.1",
            resolve
          );
        }
      );
    },

    stop() {
      return new Promise(
        (resolve) => {
          if (!server) {
            resolve();
            return;
          }

          server.close(() => {
            server = null;
            resolve();
          });
        }
      );
    },
  };
}

module.exports = {
  createLocalServer,
};