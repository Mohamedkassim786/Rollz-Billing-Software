import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.middleware";
import { paymentService } from "../services/paymentService";

export const paymentRouter = Router({ mergeParams: true });
const db: any = prisma;

const paymentTenderSchema = z.object({
  method: z.enum(["CASH", "UPI", "CARD"]),
  amount: z.coerce.number().int().positive("Payment amount must be positive in paise"),
  tenderedAmount: z.coerce.number().int().positive().optional(),
  externalReference: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(250).optional(),
  confirmationType: z.string().trim().max(50).optional(),
});

const processPaymentSchema = z.object({
  payments: z.array(paymentTenderSchema).min(1, "At least one payment method is required"),
  idempotencyKey: z.string().trim().max(100).optional(),
});

/**
 * POST /api/orders/:id/payments
 * Record payment tenders and finalize order
 */
paymentRouter.post(["/", ""], authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const cashierId = req.user!.userId;
  const orderId = req.params.id;

  const parseResult = processPaymentSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid payment payload",
        details: parseResult.error.format(),
      },
    });
    return;
  }

  const { payments, idempotencyKey } = parseResult.data;

  try {
    const result = await paymentService.processPaymentAndFinalize(
      {
        orderId,
        branchId,
        cashierId,
        payments,
        idempotencyKey,
      },
      db
    );

    res.status(200).json({
      success: true,
      message: "Payment processed and order finalized successfully",
      ...result,
    });
  } catch (err: any) {
    console.error("Payment finalization failed:", err);
    res.status(400).json({
      error: {
        code: "PAYMENT_FAILED",
        message: err.message || "Failed to process payment and finalize order",
      },
    });
  }
});

/**
 * GET /api/orders/:id/payments
 * Retrieve confirmed payments for an order
 */
paymentRouter.get(["/", ""], authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const orderId = req.params.id;

  const payments = await db.payment.findMany({
    where: { orderId, branchId },
    include: {
      confirmedBy: {
        select: {
          id: true,
          displayName: true,
          username: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  res.json({ payments });
});
