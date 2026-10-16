import { FormattedPrintPayload } from "./printer.types";

const LINE_WIDTH = 42;

function padCenter(text: string, width = LINE_WIDTH): string {
  if (text.length >= width) return text;
  const left = Math.floor((width - text.length) / 2);
  const right = width - text.length - left;
  return " ".repeat(left) + text + " ".repeat(right);
}

function divider(char = "-", width = LINE_WIDTH): string {
  return char.repeat(width);
}

export interface KitchenTicketData {
  orderNumber: string;
  orderType: string;
  tableNumber?: string | null;
  cashierName: string;
  createdAt: Date | string;
  items: Array<{
    itemNameSnapshot: string;
    quantity: number;
    modifierSnapshot?: any;
    kitchenNotes?: string | null;
  }>;
  orderNotes?: string | null;
  isReprint?: boolean;
  reprintReason?: string | null;
}

export function generateKitchenTicketText(data: KitchenTicketData): FormattedPrintPayload {
  const lines: string[] = [];

  if (data.isReprint) {
    lines.push(divider("="));
    lines.push(padCenter("*** [REPRINT KITCHEN TICKET] ***"));
    if (data.reprintReason) {
      lines.push(padCenter(`Reason: ${data.reprintReason}`));
    }
    lines.push(divider("="));
  } else {
    lines.push(divider("="));
  }

  lines.push(padCenter("ROLLZ — KITCHEN ORDER TICKET (KOT)"));
  lines.push(divider("="));

  const dateObj = new Date(data.createdAt);
  const formattedTime = dateObj.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const formattedDate = dateObj.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  lines.push(`ORDER: #${data.orderNumber}`);
  lines.push(`TYPE:  ${data.orderType}${data.tableNumber ? `  (TABLE: ${data.tableNumber})` : ""}`);
  lines.push(`TIME:  ${formattedDate} ${formattedTime}`);
  lines.push(`STAFF: ${data.cashierName}`);
  lines.push(divider("-"));
  lines.push("ITEMS TO PREPARE:");
  lines.push(divider("-"));

  for (const item of data.items) {
    lines.push(`[ ] ${item.quantity} x ${item.itemNameSnapshot.toUpperCase()}`);

    // Modifiers
    let mods = item.modifierSnapshot;
    if (typeof mods === "string") {
      try {
        mods = JSON.parse(mods);
      } catch {
        mods = [];
      }
    }
    if (Array.isArray(mods) && mods.length > 0) {
      for (const m of mods) {
        lines.push(`     • ${m.name || m.optionName}`);
      }
    }

    // Item-specific kitchen instructions
    if (item.kitchenNotes && item.kitchenNotes.trim()) {
      lines.push(`     >>> NOTE: ${item.kitchenNotes.trim()}`);
    }
    lines.push("");
  }

  if (data.orderNotes && data.orderNotes.trim()) {
    lines.push(divider("-"));
    lines.push("SPECIAL ORDER INSTRUCTIONS:");
    lines.push(`>> ${data.orderNotes.trim()}`);
  }

  lines.push(divider("="));
  lines.push(padCenter("--- END OF KITCHEN ORDER ---"));
  lines.push(divider("="));

  const rawText = lines.join("\n");

  return {
    destination: "KITCHEN",
    orderNumber: data.orderNumber,
    orderType: data.orderType,
    tableNumber: data.tableNumber,
    timestamp: `${formattedDate} ${formattedTime}`,
    cashierName: data.cashierName,
    isReprint: data.isReprint,
    reprintReason: data.reprintReason,
    rawText,
    metadata: {
      itemCount: data.items.length,
    },
  };
}
