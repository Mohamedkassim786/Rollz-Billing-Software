import { Router, Response } from "express";
import { prisma } from "../config/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.middleware";
import { printerService } from "../services/printer/printerService";

export const printJobRouter = Router();
const db: any = prisma;

/**
 * GET /api/print-jobs
 * List print jobs for the branch
 */
printJobRouter.get("/", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;

  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const destination = typeof req.query.destination === "string" ? req.query.destination : undefined;
  const orderId = typeof req.query.orderId === "string" ? req.query.orderId : undefined;

  const whereClause: any = { branchId };
  if (status) whereClause.status = status;
  if (destination) whereClause.destination = destination;
  if (orderId) whereClause.orderId = orderId;

  const printJobs = await db.printJob.findMany({
    where: whereClause,
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          orderType: true,
        },
      },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  res.json({ printJobs });
});

/**
 * GET /api/print-jobs/:id
 * Retrieve print job status and details
 */
printJobRouter.get("/:id", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const { id } = req.params;

  const printJob = await db.printJob.findFirst({
    where: { id, branchId },
    include: {
      order: true,
      invoice: true,
    },
  });

  if (!printJob) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Print job not found",
      },
    });
    return;
  }

  res.json({ printJob });
});

/**
 * POST /api/print-jobs/:id/retry
 * Retry an eligible failed print job
 */
printJobRouter.post("/:id/retry", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const { id } = req.params;

  try {
    const updatedJob = await printerService.retryPrintJob(id, branchId, db);
    res.json({
      success: true,
      message: "Print job retried successfully",
      printJob: updatedJob,
    });
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: "RETRY_FAILED",
        message: err.message || "Failed to retry print job",
      },
    });
  }
});
