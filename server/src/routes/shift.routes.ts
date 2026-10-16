import { Router, Response } from "express";
import { Role } from "@prisma/client";
import { authenticate, AuthenticatedRequest, requireRoles } from "../middleware/auth.middleware";
import { shiftService } from "../services/shiftService";
import { generateShiftClosingReportText } from "../services/printer/shiftClosingTemplate";

export const shiftRouter = Router();

shiftRouter.use(authenticate);

/**
 * POST /api/shifts/start
 * Start a new cashier shift with opening cash
 */
shiftRouter.post("/start", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const cashierId = req.user!.userId;
    const { openingCash, idempotencyKey } = req.body;

    const result = await shiftService.startShift({
      branchId,
      cashierId,
      openingCash: Number(openingCash || 0),
      idempotencyKey: (req.headers["x-idempotency-key"] as string) || idempotencyKey,
    });

    res.status(result.isDuplicate ? 200 : 201).json({
      success: true,
      message: result.isDuplicate
        ? "Existing shift retrieved"
        : `Shift #${result.shift.shiftNumber} started successfully`,
      data: result.shift,
      isDuplicate: result.isDuplicate,
    });
  } catch (err: any) {
    const isConflict = err.message && err.message.includes("already has an active open shift");
    res.status(isConflict ? 409 : 400).json({
      error: { code: isConflict ? "ACTIVE_SHIFT_EXISTS" : "START_SHIFT_FAILED", message: err.message },
    });
  }
});

/**
 * GET /api/shifts/active
 * Retrieve the active open shift and live financial metrics for the current cashier
 */
shiftRouter.get("/active", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const cashierId = req.user!.userId;

    const result = await shiftService.getActiveShift(branchId, cashierId);
    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "FETCH_ACTIVE_SHIFT_ERROR", message: err.message },
    });
  }
});

/**
 * POST /api/shifts/active/cash-movement
 * Record CASH_IN or CASH_OUT for the active cashier shift
 */
shiftRouter.post("/active/cash-movement", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const userId = req.user!.userId;
    const { shiftId, type, amount, reason, notes, idempotencyKey } = req.body;

    let targetShiftId = shiftId;
    if (!targetShiftId) {
      const active = await shiftService.getActiveShift(branchId, userId);
      if (!active || !active.shift) {
        res.status(400).json({
          error: { code: "NO_ACTIVE_SHIFT", message: "No active open shift found for this cashier" },
        });
        return;
      }
      targetShiftId = active.shift.id;
    }

    const result = await shiftService.recordCashMovement({
      branchId,
      shiftId: targetShiftId,
      userId,
      type,
      amount: Math.round(Number(amount)),
      reason,
      notes,
      idempotencyKey: (req.headers["x-idempotency-key"] as string) || idempotencyKey,
    });

    res.status(result.isDuplicate ? 200 : 201).json({
      success: true,
      message: `${type === "CASH_IN" ? "Cash added" : "Cash expense recorded"} successfully`,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({
      error: { code: "CASH_MOVEMENT_ERROR", message: err.message },
    });
  }
});

/**
 * GET /api/shifts/summary/daily
 * Daily sales & financial summary for the branch
 */
shiftRouter.get("/summary/daily", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const { date } = req.query;

    const summary = await shiftService.getDailySalesSummary(branchId, date as string);
    res.json({
      success: true,
      data: summary,
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "DAILY_SUMMARY_ERROR", message: err.message },
    });
  }
});

/**
 * GET /api/shifts
 * List all shifts with filters and pagination
 */
shiftRouter.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const { cashierId, status, startDate, endDate, page, limit } = req.query;

    // Cashiers can only view their own shifts, managers/owners can view all
    const filterCashierId =
      req.user!.role === Role.CASHIER ? req.user!.userId : (cashierId as string);

    const result = await shiftService.getShifts(branchId, {
      cashierId: filterCashierId,
      status: status as any,
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 25,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "FETCH_SHIFTS_ERROR", message: err.message },
    });
  }
});

/**
 * GET /api/shifts/:id
 * Retrieve details and full financial reconciliation for a specific shift
 */
shiftRouter.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const { id } = req.params;

    const result = await shiftService.getShiftById(id, branchId);

    // Cross-user restriction: Cashier can only view their own shift
    if (req.user!.role === Role.CASHIER && result.shift.cashierId !== req.user!.userId) {
      res.status(403).json({
        error: { code: "FORBIDDEN", message: "You do not have permission to view other cashiers' shifts" },
      });
      return;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(err.message.includes("not found") ? 404 : 500).json({
      error: { code: "NOT_FOUND", message: err.message },
    });
  }
});

/**
 * GET /api/shifts/:id/closing-preview
 * Calculate live closing preview metrics (expected cash, breakdown) before final closing
 */
shiftRouter.get("/:id/closing-preview", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const { id } = req.params;

    const financials = await shiftService.calculateShiftFinancials(id, branchId);
    res.json({
      success: true,
      data: financials,
    });
  } catch (err: any) {
    res.status(400).json({
      error: { code: "PREVIEW_ERROR", message: err.message },
    });
  }
});

/**
 * POST /api/shifts/:id/close
 * Close and reconcile a cashier shift
 */
shiftRouter.post("/:id/close", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const closingUserId = req.user!.userId;
    const { id } = req.params;
    const { actualCash, closingNotes, approvedByUserId } = req.body;

    const shiftData = await shiftService.getShiftById(id, branchId);

    // Ensure cashier can only close their own shift, unless closed by MANAGER or OWNER
    if (req.user!.role === Role.CASHIER && shiftData.shift.cashierId !== closingUserId) {
      res.status(403).json({
        error: { code: "FORBIDDEN", message: "You cannot close another cashier's shift" },
      });
      return;
    }

    const result = await shiftService.closeShift({
      branchId,
      shiftId: id,
      closingUserId,
      actualCash: Math.round(Number(actualCash)),
      closingNotes,
      approvedByUserId,
    });

    res.json({
      success: true,
      message: `Shift #${result.shift.shiftNumber} closed and reconciled successfully`,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({
      error: { code: "CLOSE_SHIFT_ERROR", message: err.message },
    });
  }
});

/**
 * GET /api/shifts/:id/report
 * Printable 80mm thermal shift closing report text and structured snapshot
 */
shiftRouter.get("/:id/report", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const { id } = req.params;

    const shiftDetail = await shiftService.getShiftById(id, branchId);
    const { shift, financials } = shiftDetail;

    const durationMinutes = shift.closedAt
      ? Math.round((new Date(shift.closedAt).getTime() - new Date(shift.openedAt).getTime()) / 60000)
      : Math.round((Date.now() - new Date(shift.openedAt).getTime()) / 60000);

    const reportText = generateShiftClosingReportText({
      restaurantName: "ROLLZ",
      branchName: shift.branch.name,
      branchCode: shift.branch.code,
      branchAddress: shift.branch.address,
      shiftNumber: shift.shiftNumber,
      cashierName: shift.cashier.displayName,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt || new Date(),
      durationMinutes,
      openingCash: shift.openingCash,
      cashSales: financials.cashSales,
      upiSales: financials.upiSales,
      cardSales: financials.cardSales,
      totalSales: financials.totalSales,
      cashInTotal: financials.cashInTotal,
      cashOutTotal: financials.cashOutTotal,
      expectedDrawerCash: financials.expectedDrawerCash,
      actualCountedCash: shift.actualCash !== null ? shift.actualCash : financials.expectedDrawerCash,
      cashDifference: shift.cashDifference !== null ? shift.cashDifference : 0,
      finalizedOrdersCount: financials.finalizedOrdersCount,
      grossSales: financials.grossSales,
      discountsTotal: financials.discountsTotal,
      taxesTotal: financials.taxesTotal,
      netSales: financials.netSales,
      closedByName: shift.closedByUser?.displayName || shift.cashier.displayName,
      closingNotes: shift.closingNotes,
    });

    res.json({
      success: true,
      reportText,
      data: {
        shift,
        financials,
      },
    });
  } catch (err: any) {
    res.status(err.message.includes("not found") ? 404 : 500).json({
      error: { code: "REPORT_ERROR", message: err.message },
    });
  }
});
