const WIDTH = 32;

function sanitize(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}

function line(char = "-") {
  return char.repeat(WIDTH);
}

function center(text = "") {
  const clean = sanitize(text);

  if (clean.length >= WIDTH) {
    return clean.slice(
      0,
      WIDTH
    );
  }

  const spaces = Math.floor(
    (WIDTH - clean.length) / 2
  );

  return (
    " ".repeat(spaces) +
    clean
  );
}

function leftRight(
  left,
  right
) {
  let leftText =
    sanitize(left);

  const rightText =
    sanitize(right);

  const available =
    WIDTH -
    rightText.length;

  if (
    leftText.length >=
    available
  ) {
    leftText =
      leftText.slice(
        0,
        Math.max(
          1,
          available - 1
        )
      );
  }

  const spaces =
    WIDTH -
    leftText.length -
    rightText.length;

  return (
    leftText +
    " ".repeat(
      Math.max(
        1,
        spaces
      )
    ) +
    rightText
  );
}

function money(value) {
  return `$${Number(
    value || 0
  ).toFixed(2)}`;
}

function getProductName(item) {
  const name =
    item.product?.name ||
    item.name ||
    item.note ||
    "Item";

  const variantName =
    item.variant?.name ||
    item.variantName;

  if (variantName) {
    return `${name} ${variantName}`;
  }

  return name;
}

function buildTicketText(order) {
  const output = [];

  output.push(
    center("LA BARRA")
  );

  output.push(
    center(
      "COMPROBANTE DE VENTA"
    )
  );

  output.push(line());

  output.push(
    leftRight(
      "Pedido:",
      `#${String(
        order.id
      ).slice(-8)}`
    )
  );

  output.push(
    leftRight(
      "Tipo:",
      order.table
        ? `Mesa ${order.table.number}`
        : "Para llevar"
    )
  );

  const date = new Date(
    order.updatedAt ||
      order.createdAt ||
      Date.now()
  );

  output.push(
    leftRight(
      "Fecha:",
      date.toLocaleDateString(
        "es-MX"
      )
    )
  );

  output.push(
    leftRight(
      "Hora:",
      date.toLocaleTimeString(
        "es-MX",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      )
    )
  );

  output.push(line());

  output.push(
    leftRight(
      "CANT / PROD",
      "IMPORTE"
    )
  );

  output.push(line());

  for (
    const item of
    order.orderDetails || []
  ) {
    const quantity =
      Number(
        item.quantity || 0
      );

    const unitPrice =
      Number(
        item.unitPrice || 0
      );

    const amount =
      quantity *
      unitPrice;

    output.push(
      leftRight(
        `${quantity}x ${getProductName(
          item
        )}`,
        money(amount)
      )
    );

    if (item.notes) {
      output.push(
        `   > ${sanitize(
          item.notes
        )}`.slice(
          0,
          WIDTH
        )
      );
    }
  }

  output.push(line());

  output.push(
    leftRight(
      "TOTAL:",
      money(order.total)
    )
  );

  output.push(line());

  output.push("");
  output.push(
    center(
      "Gracias por tu consumo!"
    )
  );

  output.push(
    center(
      "Conserva este ticket."
    )
  );

  output.push("");
  output.push("");
  output.push("");

  return output.join("\n");
}

function buildTicketBuffer(
  order
) {
  const ESC_INIT =
    Buffer.from([
      0x1b,
      0x40,
    ]);

  const ALIGN_LEFT =
    Buffer.from([
      0x1b,
      0x61,
      0x00,
    ]);

  const ALIGN_CENTER =
    Buffer.from([
      0x1b,
      0x61,
      0x01,
    ]);

  const BOLD_ON =
    Buffer.from([
      0x1b,
      0x45,
      0x01,
    ]);

  const BOLD_OFF =
    Buffer.from([
      0x1b,
      0x45,
      0x00,
    ]);

  const DOUBLE_SIZE =
    Buffer.from([
      0x1d,
      0x21,
      0x11,
    ]);

  const NORMAL_SIZE =
    Buffer.from([
      0x1d,
      0x21,
      0x00,
    ]);

  const ticketText =
    buildTicketText(order);

  /*
   * Quitamos las primeras
   * dos líneas porque el
   * encabezado se imprimirá
   * con comandos ESC/POS.
   */

  const lines =
    ticketText.split("\n");

  const body =
    lines
      .slice(2)
      .join("\n");

  return Buffer.concat([
    ESC_INIT,

    ALIGN_CENTER,
    BOLD_ON,
    DOUBLE_SIZE,

    Buffer.from(
      "LA BARRA\n",
      "ascii"
    ),

    NORMAL_SIZE,
    BOLD_OFF,

    Buffer.from(
      "COMPROBANTE DE VENTA\n",
      "ascii"
    ),

    ALIGN_LEFT,

    Buffer.from(
      body,
      "ascii"
    ),

    Buffer.from(
      "\n\n\n",
      "ascii"
    ),
  ]);
}

module.exports = {
  buildTicketText,
  buildTicketBuffer,
};