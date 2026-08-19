# La Barra Caja

Aplicación Electron para Windows que conecta el POS web de **La Barra** con el cajón de dinero conectado al puerto `CASH/DK` de una impresora térmica USB.

## Configuración inicial

- Cola de Windows: `Generic / Text Only`
- Puerto: `USB001`
- Formato: `RAW`
- API local: `http://127.0.0.1:17321`
- Pulso ESC/POS: `1B 70 00 19 FA`

## Desarrollo

Requiere Node.js solamente en la computadora donde se compila:

```bash
npm install
npm start
```

La apertura física solo funciona en Windows. En macOS/Linux la interfaz puede abrirse, pero la prueba mostrará un aviso.

## Crear el instalador para Windows

Desde Windows, dentro de la carpeta del proyecto:

```bash
npm install
npm run dist:win
```

El instalador se genera en `dist/La-Barra-Caja-Setup-1.0.0.exe`. La computadora del restaurante no necesitará Node.js.

## Uso

1. Instala y abre **La Barra Caja**.
2. Confirma que la impresora seleccionada sea `Generic / Text Only` y muestre `USB001`.
3. Presiona **Abrir caja de prueba**.
4. Copia el token secreto y colócalo en la variable privada del POS.
5. Agrega el dominio real del POS en **Orígenes permitidos**.

La aplicación se minimiza a la bandeja al cerrar la ventana y puede arrancar automáticamente con Windows.

## Integración con Next.js

La llamada debe hacerse desde un componente del navegador de la computadora de caja. Un servidor desplegado en Vercel no puede acceder al `localhost` de la caja.

```js
export async function openCashDrawer() {
  const response = await fetch("http://127.0.0.1:17321/drawer/open", {
    method: "POST",
    headers: {
      "X-La-Barra-Token": process.env.NEXT_PUBLIC_CASH_DRAWER_TOKEN,
    },
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "No se pudo abrir la caja");
  return result;
}
```

> Nota de seguridad: una variable `NEXT_PUBLIC_*` es visible en el navegador. Para una sola terminal esto evita solicitudes casuales externas porque el servicio acepta únicamente `127.0.0.1`, valida el origen y exige token. Para un esquema más fuerte, puede implementarse emparejamiento y firma de solicitudes en una versión posterior.

Comprobación del servicio:

```js
fetch("http://127.0.0.1:17321/health").then((response) => response.json());
```

## Si el cajón no abre

1. Confirma que el cajón esté conectado a `CASH/DK`, no directamente a la PC.
2. Cambia **Pin del cajón** de `Pin 2 (0)` a `Pin 5 (1)` y repite la prueba.
3. Revisa que no haya trabajos detenidos en la cola `Generic / Text Only`.
4. Confirma que la impresora siga usando `USB001` y el procesador RAW.
5. Algunas impresoras requieren tiempos distintos; los valores internos iniciales son 50 ms y 500 ms.

## Rutas

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/health` | Estado del servicio y la impresora |
| `POST` | `/drawer/open` | Envía el pulso de apertura; requiere token |

El servicio escucha exclusivamente en `127.0.0.1`; no queda expuesto a otros equipos de la red.
