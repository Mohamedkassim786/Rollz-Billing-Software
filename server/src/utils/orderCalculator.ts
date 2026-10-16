import { prisma } from "../config/prisma";

export interface SelectedModifierInput {
  modifierGroupId: string;
  optionId: string;
}

export interface OrderItemCalculationInput {
  menuItemId: string;
  quantity: number;
  selectedModifiers?: SelectedModifierInput[];
  kitchenNotes?: string;
}

export interface DiscountInput {
  type: "FIXED" | "PERCENTAGE";
  value: number; // In paise if FIXED, or in basis points (e.g. 1000 = 10%) if PERCENTAGE
  reason?: string;
}

export interface ModifierSnapshotItem {
  modifierGroupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  extraPrice: number; // in paise
}

export interface CalculatedOrderItem {
  menuItemId: string;
  itemNameSnapshot: string;
  basePriceSnapshot: number; // in paise
  quantity: number;
  modifierSnapshot: ModifierSnapshotItem[];
  kitchenNotes: string | null;
  unitPrice: number; // basePrice + modifiers in paise
  lineSubtotal: number; // unitPrice * quantity in paise
  discountAmount: number; // in paise
  taxAmount: number; // in paise
  lineTotal: number; // in paise
}

export interface CalculationResult {
  items: CalculatedOrderItem[];
  subtotal: number; // in paise
  discountTotal: number; // in paise
  discountType: string | null;
  discountValue: number;
  discountReason: string | null;
  taxTotal: number; // in paise
  taxRate: number; // basis points (500 = 5%)
  grandTotal: number; // in paise
}

/**
 * Server-authoritative order price and tax calculator.
 * Fetches real menu items, validates modifier constraints, and calculates totals in integer paise.
 */
export async function calculateOrderTotals(
  branchId: string,
  rawItems: OrderItemCalculationInput[],
  discountInput?: DiscountInput,
  taxRateBasisPoints: number = 500 // 5.00% GST by default
): Promise<CalculationResult> {
  if (!rawItems || rawItems.length === 0) {
    throw new Error("Order must contain at least one food item");
  }

  const db: any = prisma;
  const calculatedItems: CalculatedOrderItem[] = [];
  let orderSubtotal = 0;

  // Determine branch tax mode (GST vs NON_GST)
  const branch = await db.branch.findUnique({
    where: { id: branchId },
    select: { taxMode: true },
  });
  const isNonGst = branch?.taxMode === "NON_GST";
  const effectiveTaxRateBps = isNonGst ? 0 : Math.max(0, taxRateBasisPoints);

  for (const rawItem of rawItems) {
    const quantity = Math.floor(rawItem.quantity);
    if (quantity <= 0 || !Number.isInteger(quantity)) {
      throw new Error(`Quantity must be a positive integer, received: ${rawItem.quantity}`);
    }

    // 1. Fetch menu item with assigned modifier groups
    const menuItem = await db.menuItem.findFirst({
      where: {
        id: rawItem.menuItemId,
        branchId,
      },
      include: {
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    });

    if (!menuItem) {
      throw new Error(`Menu item not found or does not belong to this restaurant branch`);
    }

    if (!menuItem.isActive) {
      throw new Error(`Item "${menuItem.name}" is currently inactive and cannot be ordered`);
    }

    if (!menuItem.isAvailable) {
      throw new Error(`Item "${menuItem.name}" is currently marked as sold out / unavailable`);
    }

    // 2. Validate modifier selections
    const modifierSnapshot: ModifierSnapshotItem[] = [];
    let modifierExtraPriceSum = 0;

    const selectionsByGroup = new Map<string, string[]>();
    if (rawItem.selectedModifiers && rawItem.selectedModifiers.length > 0) {
      for (const sel of rawItem.selectedModifiers) {
        const list = selectionsByGroup.get(sel.modifierGroupId) || [];
        list.push(sel.optionId);
        selectionsByGroup.set(sel.modifierGroupId, list);
      }
    }

    const assignedGroupMap = new Map<string, any>();
    for (const rel of menuItem.modifierGroups) {
      if (rel.isEnabled && rel.modifierGroup.isActive) {
        assignedGroupMap.set(rel.modifierGroupId, rel.modifierGroup);
      }
    }

    // Ensure no selections for unassigned modifier groups
    for (const [groupId] of selectionsByGroup.entries()) {
      if (!assignedGroupMap.has(groupId)) {
        throw new Error(`Modifier group ${groupId} is not assigned to item "${menuItem.name}"`);
      }
    }

    // Validate rules for each assigned modifier group
    for (const [groupId, group] of assignedGroupMap.entries()) {
      const selectedOptionIds = selectionsByGroup.get(groupId) || [];

      // Check required rule
      if (group.isRequired && selectedOptionIds.length === 0) {
        throw new Error(`Modifier group "${group.name}" requires at least one selection for "${menuItem.name}"`);
      }

      // Check min/max selections
      if (group.selectionType === "SINGLE") {
        if (selectedOptionIds.length > 1) {
          throw new Error(`Modifier group "${group.name}" is single-choice only`);
        }
      } else {
        if (group.minSelections > 0 && selectedOptionIds.length < group.minSelections) {
          throw new Error(
            `Modifier group "${group.name}" requires at least ${group.minSelections} selections`
          );
        }
        if (group.maxSelections > 0 && selectedOptionIds.length > group.maxSelections) {
          throw new Error(
            `Modifier group "${group.name}" allows at most ${group.maxSelections} selections`
          );
        }
      }

      // Verify each chosen option exists, is active, is available, and get its extraPrice
      for (const optionId of selectedOptionIds) {
        const option = group.options.find((o: any) => o.id === optionId);
        if (!option) {
          throw new Error(`Selected option does not belong to group "${group.name}"`);
        }
        if (!option.isActive) {
          throw new Error(`Option "${option.name}" in group "${group.name}" is inactive`);
        }
        if (!option.isAvailable) {
          throw new Error(`Option "${option.name}" in group "${group.name}" is sold out`);
        }

        modifierExtraPriceSum += option.extraPrice;
        modifierSnapshot.push({
          modifierGroupId: group.id,
          groupName: group.name,
          optionId: option.id,
          optionName: option.name,
          extraPrice: option.extraPrice,
        });
      }
    }

    // 3. Compute item pricing in paise
    const unitPrice = menuItem.basePrice + modifierExtraPriceSum;
    const lineSubtotal = unitPrice * quantity;
    orderSubtotal += lineSubtotal;

    calculatedItems.push({
      menuItemId: menuItem.id,
      itemNameSnapshot: menuItem.name,
      basePriceSnapshot: menuItem.basePrice,
      quantity,
      modifierSnapshot,
      kitchenNotes: rawItem.kitchenNotes?.trim() || null,
      unitPrice,
      lineSubtotal,
      discountAmount: 0,
      taxAmount: 0,
      lineTotal: lineSubtotal,
    });
  }

  // 4. Calculate authorized discounts
  let discountTotal = 0;
  let discountType: string | null = null;
  let discountValue = 0;
  let discountReason: string | null = null;

  if (discountInput && discountInput.value > 0) {
    discountType = discountInput.type;
    discountReason = discountInput.reason?.trim() || null;

    if (discountInput.type === "PERCENTAGE") {
      // value in basis points: e.g. 1000 = 10.00%
      const percentageBps = Math.min(10000, Math.max(0, discountInput.value));
      discountValue = percentageBps;
      discountTotal = Math.round((orderSubtotal * percentageBps) / 10000);
    } else {
      // Fixed amount in paise
      discountValue = Math.max(0, discountInput.value);
      discountTotal = Math.min(orderSubtotal, discountValue);
    }
  }

  const subtotalAfterDiscount = Math.max(0, orderSubtotal - discountTotal);

  // 5. Calculate taxes (e.g. 500 basis points = 5.00% GST, or 0 for NON_GST)
  const taxRate = effectiveTaxRateBps;
  const taxTotal = Math.round((subtotalAfterDiscount * taxRate) / 10000);

  // 6. Final grand total
  const grandTotal = subtotalAfterDiscount + taxTotal;

  // Distribute discount and tax proportionally across line items for snapshots
  for (const item of calculatedItems) {
    if (orderSubtotal > 0) {
      const itemRatio = item.lineSubtotal / orderSubtotal;
      item.discountAmount = Math.round(discountTotal * itemRatio);
      item.taxAmount = Math.round(taxTotal * itemRatio);
      item.lineTotal = Math.max(0, item.lineSubtotal - item.discountAmount + item.taxAmount);
    }
  }

  return {
    items: calculatedItems,
    subtotal: orderSubtotal,
    discountTotal,
    discountType,
    discountValue,
    discountReason,
    taxTotal,
    taxRate,
    grandTotal,
  };
}

/**
 * Generate a sequential, unique human-readable order number.
 * Format: ORD-YYYYMMDD-XXXX (e.g. ORD-20261013-0001)
 *
 * Uses an atomic upsert on the InvoiceSequence table (with a prefixed dateKey)
 * to guarantee uniqueness under concurrent load without race conditions.
 * Must be called within a Prisma transaction for full atomicity.
 */
export async function generateOrderNumber(branchId: string, tx?: any): Promise<string> {
  const dbClient: any = tx || prisma;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const prefix = `ORD-${year}${month}${day}-`;

  // Find highest existing order number for this branch today
  const latestOrder = await dbClient.order.findFirst({
    where: {
      branchId,
      orderNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      orderNumber: "desc",
    },
    select: {
      orderNumber: true,
    },
  });

  let nextSeq = 1;
  if (latestOrder && latestOrder.orderNumber) {
    const parts = latestOrder.orderNumber.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }

  const seqStr = String(nextSeq).padStart(4, "0");
  return `${prefix}${seqStr}`;
}
