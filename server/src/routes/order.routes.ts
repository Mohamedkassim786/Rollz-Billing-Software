import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  calculateOrderTotals,
  generateOrderNumber,
} from "../utils/orderCalculator";
import { paymentRouter } from "./payment.routes";

export const orderRouter = Router();
const db: any = prisma;

// Mount payments sub-router for /api/orders/:id/payments
orderRouter.use("/:id/payments", paymentRouter);

const orderItemInputSchema = z.object({
  menuItemId: z.string().uuid("Invalid menu item ID"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  selectedModifiers: z
    .array(
      z.object({
        modifierGroupId: z.string().uuid(),
        optionId: z.string().uuid(),
      })
    )
    .optional(),
  kitchenNotes: z.string().trim().max(200).optional(),
});

const discountInputSchema = z.object({
  type: z.enum(["FIXED", "PERCENTAGE"]),
  value: z.coerce.number().int().min(0),
  reason: z.string().trim().max(100).optional(),
});

const calculateOrderSchema = z.object({
  orderType: z.enum(["TAKEAWAY", "DINE_IN"]).default("TAKEAWAY"),
  items: z.array(orderItemInputSchema).min(1, "At least one item is required"),
  discount: discountInputSchema.optional(),
  taxRateBasisPoints: z.coerce.number().int().min(0).max(5000).default(500),
});

const createOrderSchema = z.object({
  orderType: z.enum(["TAKEAWAY", "DINE_IN"]).default("TAKEAWAY"),
  tableNumber: z.string().trim().max(30).nullable().optional(),
  customerName: z.string().trim().max(100).nullable().optional(),
  customerPhone: z.string().trim().max(20).nullable().optional(),
  notes: z.string().trim().max(300).nullable().optional(),
  items: z.array(orderItemInputSchema).min(1, "At least one item is required"),
  discount: discountInputSchema.optional(),
  taxRateBasisPoints: z.coerce.number().int().min(0).max(5000).default(500),
});

const updateOrderSchema = z.object({
  orderType: z.enum(["TAKEAWAY", "DINE_IN"]).optional(),
  tableNumber: z.string().trim().max(30).nullable().optional(),
  customerName: z.string().trim().max(100).nullable().optional(),
  customerPhone: z.string().trim().max(20).nullable().optional(),
  notes: z.string().trim().max(300).nullable().optional(),
  items: z.array(orderItemInputSchema).min(1).optional(),
  discount: discountInputSchema.optional(),
  taxRateBasisPoints: z.coerce.number().int().min(0).max(5000).optional(),
});

/**
 * 1. POST /api/orders/calculate
 * Live server-authoritative calculation for client cart
 */
orderRouter.post("/calculate", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const parseResult = calculateOrderSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid order calculation parameters",
        details: parseResult.error.format(),
      },
    });
    return;
  }

  const { items, discount, taxRateBasisPoints } = parseResult.data;

  try {
    const calculation = await calculateOrderTotals(
      branchId,
      items,
      discount,
      taxRateBasisPoints
    );

    res.json({ calculation });
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: "CALCULATION_ERROR",
        message: err.message || "Failed to calculate order totals",
      },
    });
  }
});

/**
 * 2. POST /api/orders
 * Create an order draft in PostgreSQL
 */
orderRouter.post("/", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const cashierId = req.user!.userId;

  const parseResult = createOrderSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid order draft payload",
        details: parseResult.error.format(),
      },
    });
    return;
  }

  const {
    orderType,
    tableNumber,
    customerName,
    customerPhone,
    notes,
    items,
    discount,
    taxRateBasisPoints,
  } = parseResult.data;

  // DINE_IN requires table validation if provided
  if (orderType === "DINE_IN" && !tableNumber) {
    // If tableNumber is missing for Dine-In, we can default to Counter/Dine-In
  }

  try {
    // Authoritative calculation on server
    const calculation = await calculateOrderTotals(
      branchId,
      items,
      discount,
      taxRateBasisPoints
    );

    // Save in PostgreSQL transaction with concurrency retry loop
    let createdOrder: any = null;
    let attempts = 0;
    while (attempts < 3) {
      try {
        attempts++;
        const orderNumber = await generateOrderNumber(branchId);
        createdOrder = await db.$transaction(async (tx: any) => {
          const order = await tx.order.create({
            data: {
              branchId,
              cashierId,
              orderNumber,
              orderType,
              status: "DRAFT",
              tableNumber: tableNumber || null,
              customerName: customerName || null,
              customerPhone: customerPhone || null,
              notes: notes || null,
              subtotal: calculation.subtotal,
              discountTotal: calculation.discountTotal,
              discountType: calculation.discountType,
              discountValue: calculation.discountValue,
              discountReason: calculation.discountReason,
              taxTotal: calculation.taxTotal,
              taxRate: calculation.taxRate,
              grandTotal: calculation.grandTotal,
            },
          });

          // Create OrderItem records with snapshots
          for (const item of calculation.items) {
            await tx.orderItem.create({
              data: {
                orderId: order.id,
                menuItemId: item.menuItemId,
                itemNameSnapshot: item.itemNameSnapshot,
                basePriceSnapshot: item.basePriceSnapshot,
                quantity: item.quantity,
                modifierSnapshot: item.modifierSnapshot,
                kitchenNotes: item.kitchenNotes,
                unitPrice: item.unitPrice,
                lineSubtotal: item.lineSubtotal,
                discountAmount: item.discountAmount,
                taxAmount: item.taxAmount,
                lineTotal: item.lineTotal,
              },
            });
          }

          return await tx.order.findUnique({
            where: { id: order.id },
            include: {
              items: true,
              cashier: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  role: true,
                },
              },
            },
          });
        });
        break;
      } catch (err: any) {
        if (err.code === "P2002" && attempts < 3) {
          continue;
        }
        throw err;
      }
    }

    res.status(201).json({
      message: "Order draft created successfully",
      order: createdOrder,
    });
  } catch (err: any) {
    console.error("Order creation failed:", err);
    res.status(400).json({
      error: {
        code: "ORDER_CREATION_FAILED",
        message: err.message || "Failed to create order draft",
      },
    });
  }
});

/**
 * 3. GET /api/orders
 * List orders for current branch with status filter
 */
orderRouter.get("/", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const orderType = typeof req.query.orderType === "string" ? req.query.orderType : undefined;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;

  const where: any = { branchId };

  if (status && status !== "ALL") {
    where.status = status;
  }
  if (orderType && orderType !== "ALL") {
    where.orderType = orderType;
  }
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
      { customerPhone: { contains: search, mode: "insensitive" } },
      { tableNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  try {
    const orders = await db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        items: true,
        cashier: {
          select: {
            id: true,
            displayName: true,
            username: true,
          },
        },
      },
    });

    res.json({ orders });
  } catch (err: any) {
    console.error("Failed to list orders:", err);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve orders",
      },
    });
  }
});

/**
 * 4. GET /api/orders/:id
 * Retrieve single order by ID with branch validation
 */
orderRouter.get("/:id", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const { id } = req.params;

  try {
    const order = await db.order.findFirst({
      where: {
        id,
        branchId,
      },
      include: {
        items: true,
        cashier: {
          select: {
            id: true,
            displayName: true,
            username: true,
            role: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!order) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Order not found in this restaurant branch",
        },
      });
      return;
    }

    res.json({ order });
  } catch (err: any) {
    console.error("Failed to retrieve order:", err);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve order details",
      },
    });
  }
});

/**
 * 5. PATCH /api/orders/:id
 * Update an existing editable draft order
 */
orderRouter.patch("/:id", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const { id } = req.params;

  const parseResult = updateOrderSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid update order payload",
        details: parseResult.error.format(),
      },
    });
    return;
  }

  const existingOrder = await db.order.findFirst({
    where: { id, branchId },
    include: { items: true },
  });

  if (!existingOrder) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Order not found",
      },
    });
    return;
  }

  // Prevent modifying finalized/confirmed orders
  if (existingOrder.status !== "DRAFT" && existingOrder.status !== "HELD") {
    res.status(400).json({
      error: {
        code: "ORDER_IMMUTABLE",
        message: `Orders in status ${existingOrder.status} cannot be modified`,
      },
    });
    return;
  }

  const {
    orderType,
    tableNumber,
    customerName,
    customerPhone,
    notes,
    items,
    discount,
    taxRateBasisPoints,
  } = parseResult.data;

  try {
    const updatedOrder = await db.$transaction(async (tx: any) => {
      const updateData: any = {};

      if (orderType !== undefined) updateData.orderType = orderType;
      if (tableNumber !== undefined) updateData.tableNumber = tableNumber;
      if (customerName !== undefined) updateData.customerName = customerName;
      if (customerPhone !== undefined) updateData.customerPhone = customerPhone;
      if (notes !== undefined) updateData.notes = notes;

      // If items are provided, recalculate and replace items
      if (items && items.length > 0) {
        const calculation = await calculateOrderTotals(
          branchId,
          items,
          discount,
          taxRateBasisPoints ?? existingOrder.taxRate
        );

        updateData.subtotal = calculation.subtotal;
        updateData.discountTotal = calculation.discountTotal;
        updateData.discountType = calculation.discountType;
        updateData.discountValue = calculation.discountValue;
        updateData.discountReason = calculation.discountReason;
        updateData.taxTotal = calculation.taxTotal;
        updateData.taxRate = calculation.taxRate;
        updateData.grandTotal = calculation.grandTotal;

        // Delete existing items and recreate
        await tx.orderItem.deleteMany({
          where: { orderId: existingOrder.id },
        });

        for (const item of calculation.items) {
          await tx.orderItem.create({
            data: {
              orderId: existingOrder.id,
              menuItemId: item.menuItemId,
              itemNameSnapshot: item.itemNameSnapshot,
              basePriceSnapshot: item.basePriceSnapshot,
              quantity: item.quantity,
              modifierSnapshot: item.modifierSnapshot,
              kitchenNotes: item.kitchenNotes,
              unitPrice: item.unitPrice,
              lineSubtotal: item.lineSubtotal,
              discountAmount: item.discountAmount,
              taxAmount: item.taxAmount,
              lineTotal: item.lineTotal,
            },
          });
        }
      }

      await tx.order.update({
        where: { id: existingOrder.id },
        data: updateData,
      });

      return await tx.order.findUnique({
        where: { id: existingOrder.id },
        include: {
          items: true,
          cashier: {
            select: {
              id: true,
              displayName: true,
              username: true,
            },
          },
        },
      });
    });

    res.json({
      message: "Order updated successfully",
      order: updatedOrder,
    });
  } catch (err: any) {
    console.error("Failed to update order:", err);
    res.status(400).json({
      error: {
        code: "UPDATE_FAILED",
        message: err.message || "Failed to update order",
      },
    });
  }
});

/**
 * 6. POST /api/orders/:id/hold
 * Put an active draft order on hold
 */
orderRouter.post("/:id/hold", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const { id } = req.params;

  const order = await db.order.findFirst({
    where: { id, branchId },
  });

  if (!order) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Order not found" },
    });
    return;
  }

  if (order.status !== "DRAFT") {
    res.status(400).json({
      error: {
        code: "INVALID_STATUS_TRANSITION",
        message: `Only DRAFT orders can be put on hold (current status: ${order.status})`,
      },
    });
    return;
  }

  const updated = await db.order.update({
    where: { id },
    data: { status: "HELD" },
    include: { items: true },
  });

  res.json({
    message: "Order placed on hold",
    order: updated,
  });
});

/**
 * 7. POST /api/orders/:id/resume
 * Resume a held order back into active draft
 */
orderRouter.post("/:id/resume", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const { id } = req.params;

  const order = await db.order.findFirst({
    where: { id, branchId },
  });

  if (!order) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Order not found" },
    });
    return;
  }

  if (order.status !== "HELD") {
    res.status(400).json({
      error: {
        code: "INVALID_STATUS_TRANSITION",
        message: `Only HELD orders can be resumed (current status: ${order.status})`,
      },
    });
    return;
  }

  const updated = await db.order.update({
    where: { id },
    data: { status: "DRAFT" },
    include: { items: true },
  });

  res.json({
    message: "Held order resumed",
    order: updated,
  });
});

/**
 * 8. DELETE /api/orders/:id
 * Cancel an unfinalized draft or held order
 */
orderRouter.delete("/:id", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const { id } = req.params;

  const order = await db.order.findFirst({
    where: { id, branchId },
  });

  if (!order) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Order not found" },
    });
    return;
  }

  if (order.status !== "DRAFT" && order.status !== "HELD") {
    res.status(400).json({
      error: {
        code: "CANNOT_CANCEL",
        message: `Cannot cancel order with status ${order.status}`,
      },
    });
    return;
  }

  const cancelled = await db.order.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  res.json({
    message: "Order draft cancelled",
    order: cancelled,
  });
});
