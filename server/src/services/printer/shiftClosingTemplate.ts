/**
 * Formats a clean 42-column 80mm thermal receipt report for Cashier Shift Closing.
 */

export interface ShiftClosingReportInput {
  restaurantName?: string;
  branchName: string;
  branchCode: string;
  branchAddress?: string | null;
  shiftNumber: string;
  cashierName: string;
  openedAt: Date | string;
  closedAt: Date | string;
  durationMinutes: number;
  openingCash: number; // in paise
  cashSales: number;
  upiSales: number;
  cardSales: number;
  totalSales: number;
  cashInTotal: number;
  cashOutTotal: number;
  expectedDrawerCash: number;
  actualCountedCash: number;
  cashDifference: number;
  finalizedOrdersCount: number;
  grossSales: number;
  discountsTotal: number;
  taxesTotal: number;
  netSales: number;
  closedByName?: string;
  closingNotes?: string | null;
}

const LINE_WIDTH = 42;

function centerText(text: string): string {
  if (text.length >= LINE_WIDTH) return text.substring(0, LINE_WIDTH);
  const leftPadding = Math.floor((LINE_WIDTH - text.length) / 2);
  return " ".repeat(leftPadding) + text;
}

function row(left: string, right: string): string {
  const space = LINE_WIDTH - left.length - right.length;
  if (space <= 0) return `${left} ${right}`;
  return left + " ".repeat(space) + right;
}

function divider(char = "-"): string {
  return char.repeat(LINE_WIDTH);
}

function formatCurrency(paise: number): string {
  return "Rs " + (paise / 100).toFixed(2);
}

export function generateShiftClosingReportText(data: ShiftClosingReportInput): string {
  const lines: string[] = [];

  // Header
  lines.push(centerText(data.restaurantName || "ROLLZ"));
  lines.push(centerText("SHIFT CLOSING & CASH REPORT"));
  lines.push(centerText(data.branchName));
  if (data.branchAddress) {
    lines.push(centerText(data.branchAddress.substring(0, LINE_WIDTH)));
  }
  lines.push(divider("="));

  // Shift Meta
  lines.push(row("Shift Number:", data.shiftNumber));
  lines.push(row("Cashier:", data.cashierName));
  lines.push(
    row(
      "Opened:",
      new Date(data.openedAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }) +
        " " +
        new Date(data.openedAt).toLocaleDateString("en-IN")
    )
  );
  lines.push(
    row(
      "Closed:",
      new Date(data.closedAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }) +
        " " +
        new Date(data.closedAt).toLocaleDateString("en-IN")
    )
  );
  lines.push(row("Duration:", `${data.durationMinutes} mins`));
  lines.push(divider("-"));

  // Sales Summary
  lines.push(centerText("--- SALES SUMMARY ---"));
  lines.push(row("Finalized Orders:", String(data.finalizedOrdersCount)));
  lines.push(row("Gross Sales:", formatCurrency(data.grossSales)));
  if (data.discountsTotal > 0) {
    lines.push(row("Discounts Applied:", "-" + formatCurrency(data.discountsTotal)));
  }
  lines.push(row("Taxes Collected (GST):", formatCurrency(data.taxesTotal)));
  lines.push(row("NET FINALIZED SALES:", formatCurrency(data.netSales)));
  lines.push(divider("-"));

  // Payment Tender Breakdown
  lines.push(centerText("--- PAYMENT METHODS ---"));
  lines.push(row("Cash Tenders:", formatCurrency(data.cashSales)));
  lines.push(row("UPI Tenders:", formatCurrency(data.upiSales)));
  lines.push(row("Card Tenders:", formatCurrency(data.cardSales)));
  lines.push(row("TOTAL COLLECTED:", formatCurrency(data.totalSales)));
  lines.push(divider("-"));

  // Cash Drawer Reconciliation
  lines.push(centerText("--- CASH DRAWER RECONCILIATION ---"));
  lines.push(row("Opening Cash Float:", formatCurrency(data.openingCash)));
  lines.push(row("(+) Cash Sales:", formatCurrency(data.cashSales)));
  if (data.cashInTotal > 0) {
    lines.push(row("(+) Cash Added (In):", formatCurrency(data.cashInTotal)));
  }
  if (data.cashOutTotal > 0) {
    lines.push(row("(-) Cash Expenses (Out):", "-" + formatCurrency(data.cashOutTotal)));
  }
  lines.push(divider("-"));
  lines.push(row("EXPECTED DRAWER CASH:", formatCurrency(data.expectedDrawerCash)));
  lines.push(row("ACTUAL COUNTED CASH:", formatCurrency(data.actualCountedCash)));
  lines.push(divider("="));

  // Discrepancy
  const diff = data.cashDifference;
  if (diff === 0) {
    lines.push(centerText("*** DRAWER RECONCILED EXACTLY ***"));
  } else if (diff > 0) {
    lines.push(row("CASH SURPLUS:", "+" + formatCurrency(diff)));
    lines.push(centerText("(! OVERAGE RECORDED !)"));
  } else {
    lines.push(row("CASH SHORTAGE:", "-" + formatCurrency(Math.abs(diff))));
    lines.push(centerText("(! SHORTAGE RECORDED !)"));
  }
  lines.push(divider("-"));

  // Audit Footer
  if (data.closedByName) {
    lines.push(row("Closed By:", data.closedByName));
  }
  if (data.closingNotes) {
    lines.push("Notes: " + data.closingNotes);
  }
  lines.push("");
  lines.push(row("Cashier Sign: ________", "Manager Sign: ________"));
  lines.push("");
  lines.push(centerText("--- END OF REPORT ---"));

  return lines.join("\n");
}
