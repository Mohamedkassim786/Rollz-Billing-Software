import { FormattedPrintPayload } from "./printer.types";

function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return "Rs." + rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const LINE_WIDTH = 42;

function padCenter(text: string, width = LINE_WIDTH): string {
  if (text.length >= width) return text;
  const left = Math.floor((width - text.length) / 2);
  const right = width - text.length - left;
  return " ".repeat(left) + text + " ".repeat(right);
}

function row(left: string, right: string, width = LINE_WIDTH): string {
  const availableLeft = width - right.length - 1;
  const trimmedLeft = left.length > availableLeft ? left.substring(0, availableLeft) : left;
  const spaces = width - trimmedLeft.length - right.length;
  return trimmedLeft + " ".repeat(Math.max(1, spaces)) + right;
}

function divider(char = "-", width = LINE_WIDTH): string {
  return char.repeat(width);
}

export interface ReceiptData {
  restaurantName: string;
  branchName: string;
  branchAddress?: string | null;
  branchPhone?: string | null;
  gstin?: string | null;
  taxMode?: string | null;
  invoiceNumber: string;
  orderNumber: string;
  orderType: string;
  tableNumber?: string | null;
  cashierName: string;
  createdAt: Date | string;
  items: Array<{
    itemNameSnapshot: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    modifierSnapshot?: any;
    kitchenNotes?: string | null;
  }>;
  subtotal: number;
  discountTotal: number;
  discountReason?: string | null;
  taxTotal: number;
  taxRate?: number;
  grandTotal: number;
  payments: Array<{
    method: "CASH" | "UPI" | "CARD";
    amount: number;
    tenderedAmount?: number | null;
    changeDue?: number | null;
    externalReference?: string | null;
  }>;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  logoPath?: string | null;
  isReprint?: boolean;
  reprintReason?: string | null;
}

export function generateCustomerReceiptText(data: ReceiptData): FormattedPrintPayload {
  const lines: string[] = [];

  if (data.isReprint) {
    lines.push(divider("="));
    lines.push(padCenter("*** [REPRINT COPY] ***"));
    if (data.reprintReason) {
      lines.push(padCenter(`Reason: ${data.reprintReason}`));
    }
    lines.push(divider("="));
  } else {
    lines.push(divider("="));
  }

  // Restaurant Information
  if (data.branchName) lines.push(padCenter(data.branchName));
  if (data.branchAddress) lines.push(padCenter(data.branchAddress));
  if (data.branchPhone) lines.push(padCenter(`Tel: ${data.branchPhone}`));

  // GSTIN (only printed in GST mode)
  if (data.taxMode !== "NON_GST" && data.gstin) {
    lines.push(padCenter(`GSTIN: ${data.gstin}`));
  }

  lines.push(divider("-"));

  const dateObj = new Date(data.createdAt);
  const formattedDate = dateObj.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  lines.push(row("Invoice No:", data.invoiceNumber));
  lines.push(row("Order No:", `#${data.orderNumber}`));
  lines.push(row("Date & Time:", formattedDate));
  lines.push(row("Order Type:", data.orderType + (data.tableNumber ? ` (Table: ${data.tableNumber})` : "")));
  lines.push(row("Cashier:", data.cashierName));

  lines.push(divider("-"));
  lines.push(row("ITEM", "QTY   AMOUNT"));
  lines.push(divider("-"));

  for (const item of data.items) {
    const itemTotalStr = formatPaise(item.lineTotal);
    const qtyStr = `${item.quantity}`.padStart(3, " ");
    const rightCol = `${qtyStr} ${itemTotalStr}`;

    lines.push(row(item.itemNameSnapshot, rightCol));

    // Modifiers list
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
        const modPrice = m.extraPrice ? ` (+${formatPaise(m.extraPrice)})` : "";
        lines.push(`  + ${m.name || m.optionName}${modPrice}`);
      }
    }
  }

  lines.push(divider("-"));
  lines.push(row("Subtotal:", formatPaise(data.subtotal)));

  if (data.discountTotal > 0) {
    const discLabel = data.discountReason ? `Discount (${data.discountReason}):` : "Discount:";
    lines.push(row(discLabel, `-${formatPaise(data.discountTotal)}`));
  }

  if (data.taxTotal > 0) {
    // GST split: CGST (half) + SGST (half)
    const taxRateBps = typeof data.taxRate === "number" ? data.taxRate : 500;
    const halfRatePct = (taxRateBps / 2 / 100).toFixed(1); // e.g. 500 -> "2.5"
    const halfTax = Math.floor(data.taxTotal / 2);
    const otherHalf = data.taxTotal - halfTax;
    lines.push(row(`CGST (${halfRatePct}%):`, formatPaise(halfTax)));
    lines.push(row(`SGST (${halfRatePct}%):`, formatPaise(otherHalf)));
  }

  lines.push(divider("="));
  lines.push(row("NET TOTAL PAYABLE:", formatPaise(data.grandTotal)));
  lines.push(divider("="));

  // Payment Breakdown
  lines.push("PAYMENT SUMMARY:");
  if (data.payments && data.payments.length > 0) {
    for (const p of data.payments) {
      lines.push(row(`  - ${p.method}:`, formatPaise(p.amount)));
      if (p.method === "CASH" && p.tenderedAmount !== undefined && p.tenderedAmount !== null) {
        lines.push(row("    Cash Tendered:", formatPaise(p.tenderedAmount)));
        lines.push(row("    Change Returned:", formatPaise(p.changeDue || 0)));
      }
      if (p.externalReference) {
        lines.push(`    Ref / Txn ID: ${p.externalReference}`);
      }
    }
  }

  lines.push(divider("-"));

  if (data.receiptFooter) {
    for (const fLine of data.receiptFooter.split("\n")) {
      if (fLine.trim()) lines.push(padCenter(fLine.trim()));
    }
  } else {
    lines.push(padCenter("Thank you for choosing ROLLZ!"));
    lines.push(padCenter("Visit again soon!"));
  }
  lines.push(divider("="));

  const rawText = lines.join("\n");

  return {
    destination: "CUSTOMER_RECEIPT",
    invoiceNumber: data.invoiceNumber,
    orderNumber: data.orderNumber,
    orderType: data.orderType,
    tableNumber: data.tableNumber,
    timestamp: formattedDate,
    cashierName: data.cashierName,
    isReprint: data.isReprint,
    reprintReason: data.reprintReason,
    rawText,
    metadata: {
      grandTotal: data.grandTotal,
      itemCount: data.items.length,
      logoPath: data.logoPath || null,
    },
  };
}
