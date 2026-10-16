export async function generateInvoiceNumber(branchId: string, tx: any): Promise<string> {
  const today = new Date();
  const dateKey = today.toISOString().slice(0, 10).replace(/-/g, ""); // e.g. "20261013"

  const sequence = await tx.invoiceSequence.upsert({
    where: {
      branchId_dateKey: {
        branchId,
        dateKey,
      },
    },
    update: {
      lastSeq: { increment: 1 },
    },
    create: {
      branchId,
      dateKey,
      lastSeq: 1,
    },
  });

  const seqStr = String(sequence.lastSeq).padStart(4, "0");
  return `INV-${dateKey}-${seqStr}`;
}

export interface InvoiceSnapshotPayload {
  restaurantName: string;
  branch: {
    id: string;
    name: string;
    code: string;
    address: string | null;
    phone: string | null;
    gstin: string | null;
    taxMode: string;
  };
  cashier: {
    id: string;
    username: string;
    displayName: string;
  };
  order: {
    id: string;
    orderNumber: string;
    orderType: string;
    tableNumber: string | null;
    customerName: string | null;
    customerPhone: string | null;
    notes: string | null;
    taxRate: number;
  };
  items: Array<{
    menuItemId: string | null;
    itemNameSnapshot: string;
    basePriceSnapshot: number;
    quantity: number;
    unitPrice: number;
    lineSubtotal: number;
    discountAmount: number;
    taxAmount: number;
    lineTotal: number;
    modifierSnapshot: any;
    kitchenNotes: string | null;
  }>;
  subtotal: number;
  discountTotal: number;
  discountReason: string | null;
  taxTotal: number;
  grandTotal: number;
  payments: Array<{
    id: string;
    method: string;
    amount: number;
    tenderedAmount: number | null;
    changeDue: number | null;
    externalReference: string | null;
    confirmationType: string;
    confirmedBy: string | null;
    confirmedAt: Date | string | null;
  }>;
  finalizedAt: string;
}

export function buildInvoiceSnapshot(data: {
  branch: any;
  cashier: any;
  order: any;
  items: any[];
  payments: any[];
}): InvoiceSnapshotPayload {
  return {
    restaurantName: "ROLLZ",
    branch: {
      id: data.branch.id,
      name: data.branch.name,
      code: data.branch.code,
      address: data.branch.address || null,
      phone: data.branch.phone || null,
      gstin: data.branch.gstin || "32AAAAA0000A1Z5",
      taxMode: data.branch.taxMode || "GST",
    },
    cashier: {
      id: data.cashier.id,
      username: data.cashier.username,
      displayName: data.cashier.displayName,
    },
    order: {
      id: data.order.id,
      orderNumber: data.order.orderNumber,
      orderType: data.order.orderType,
      tableNumber: data.order.tableNumber || null,
      customerName: data.order.customerName || null,
      customerPhone: data.order.customerPhone || null,
      notes: data.order.notes || null,
      taxRate: data.order.taxRate,
    },
    items: data.items.map((i) => ({
      menuItemId: i.menuItemId,
      itemNameSnapshot: i.itemNameSnapshot,
      basePriceSnapshot: i.basePriceSnapshot,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineSubtotal: i.lineSubtotal,
      discountAmount: i.discountAmount,
      taxAmount: i.taxAmount,
      lineTotal: i.lineTotal,
      modifierSnapshot: i.modifierSnapshot,
      kitchenNotes: i.kitchenNotes || null,
    })),
    subtotal: data.order.subtotal,
    discountTotal: data.order.discountTotal,
    discountReason: data.order.discountReason || null,
    taxTotal: data.order.taxTotal,
    grandTotal: data.order.grandTotal,
    payments: data.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: p.amount,
      tenderedAmount: p.tenderedAmount ?? null,
      changeDue: p.changeDue ?? null,
      externalReference: p.externalReference || null,
      confirmationType: p.confirmationType,
      confirmedBy: p.confirmedBy?.displayName || p.confirmedByUserId || null,
      confirmedAt: p.confirmedAt || null,
    })),
    finalizedAt: new Date().toISOString(),
  };
}
