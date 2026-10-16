import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.middleware";
import { printerService } from "../services/printer/printerService";
import { generateCustomerReceiptText } from "../services/printer/receiptTemplate";

export const invoiceRouter = Router();
const db: any = prisma;

/**
 * GET /api/invoices
 * List finalized invoices with pagination, search, and date filters
 */
invoiceRouter.get("/", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const startDate = typeof req.query.startDate === "string" ? req.query.startDate : "";
  const endDate = typeof req.query.endDate === "string" ? req.query.endDate : "";

  const whereClause: any = {
    branchId,
  };

  if (search) {
    whereClause.OR = [
      { invoiceNumber: { contains: search, mode: "insensitive" } },
      { order: { orderNumber: { contains: search, mode: "insensitive" } } },
      { order: { customerName: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) {
      whereClause.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      whereClause.createdAt.lte = end;
    }
  }

  const [totalCount, invoices] = await Promise.all([
    db.invoice.count({ where: whereClause }),
    db.invoice.findMany({
      where: whereClause,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            orderType: true,
            tableNumber: true,
            customerName: true,
            notes: true,
          },
        },
        cashier: {
          select: {
            id: true,
            displayName: true,
            username: true,
          },
        },
        printJobs: {
          select: {
            id: true,
            destination: true,
            status: true,
            attemptCount: true,
            isReprint: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  res.json({
    invoices,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  });
});

/**
 * GET /api/invoices/:id
 * Retrieve single invoice with frozen snapshot and payment history
 */
invoiceRouter.get("/:id", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const { id } = req.params;

  const invoice = await db.invoice.findFirst({
    where: { id, branchId },
    include: {
      order: {
        include: {
          items: true,
          payments: true,
        },
      },
      cashier: {
        select: {
          id: true,
          displayName: true,
          username: true,
        },
      },
      branch: true,
      printJobs: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!invoice) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Invoice not found",
      },
    });
    return;
  }

  res.json({ invoice });
});

/**
 * GET /api/invoices/:id/receipt
 * Retrieve formatted 80mm thermal receipt text
 */
invoiceRouter.get("/:id/receipt", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const { id } = req.params;

  const invoice = await db.invoice.findFirst({
    where: { id, branchId },
    include: {
      order: {
        include: {
          items: true,
          payments: true,
        },
      },
      cashier: true,
      branch: true,
    },
  });

  if (!invoice) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Invoice not found",
      },
    });
    return;
  }

  const snapshot = invoice.snapshot as any;
  const receiptPayload = generateCustomerReceiptText({
    restaurantName: "ROLLZ",
    branchName: invoice.branch.name,
    branchAddress: invoice.branch.address,
    branchPhone: invoice.branch.phone,
    gstin: invoice.branch.gstin,
    taxMode: invoice.branch.taxMode,
    invoiceNumber: invoice.invoiceNumber,
    orderNumber: invoice.order.orderNumber,
    orderType: invoice.order.orderType,
    tableNumber: invoice.order.tableNumber,
    cashierName: invoice.cashier.displayName,
    createdAt: invoice.createdAt,
    items: snapshot.items || invoice.order.items,
    subtotal: invoice.subtotal,
    discountTotal: invoice.discountTotal,
    discountReason: invoice.order.discountReason,
    taxTotal: invoice.taxTotal,
    taxRate: invoice.order.taxRate,
    grandTotal: invoice.grandTotal,
    payments: snapshot.payments || invoice.order.payments,
    receiptHeader: invoice.branch.receiptHeader,
    receiptFooter: invoice.branch.receiptFooter,
    isReprint: false,
  });

  res.json({ receipt: receiptPayload });
});

const reprintSchema = z.object({
  destination: z.enum(["CUSTOMER_RECEIPT", "KITCHEN"]).default("CUSTOMER_RECEIPT"),
  reason: z.string().trim().max(100).default("Customer Request"),
});

/**
 * POST /api/invoices/:id/reprint
 * Create an authorized reprint job labeled with [REPRINT]
 */
invoiceRouter.post("/:id/reprint", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const { id } = req.params;

  const parseResult = reprintSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid reprint parameters",
        details: parseResult.error.format(),
      },
    });
    return;
  }

  const { destination, reason } = parseResult.data;

  try {
    const printJob = await printerService.createReprintJob(
      {
        invoiceId: id,
        branchId,
        destination,
        reason,
        cashierName: req.user!.displayName || req.user!.username,
      },
      db
    );

    res.json({
      success: true,
      message: `${destination} reprint job created successfully`,
      printJob,
    });
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: "REPRINT_FAILED",
        message: err.message || "Failed to create reprint job",
      },
    });
  }
});
