import { Router, Response } from "express";
import { Role } from "@prisma/client";
import { authenticate, AuthenticatedRequest, requireRoles } from "../middleware/auth.middleware";
import { reportService } from "../services/reportService";
import { parseDateRangeIST } from "../utils/reportDateUtils";

export const reportRouter = Router();

// All reporting routes require authentication and managerial roles
reportRouter.use(authenticate);
reportRouter.use(requireRoles([Role.OWNER, Role.MANAGER]));

/**
 * Helper to extract and parse date range from query params
 */
function extractRange(req: AuthenticatedRequest) {
  const { preset, startDate, endDate } = req.query as {
    preset?: string;
    startDate?: string;
    endDate?: string;
  };
  return parseDateRangeIST({ preset, startDate, endDate });
}

/**
 * GET /api/reports/dashboard
 * Main executive analytics dashboard summary & trends
 */
reportRouter.get("/dashboard", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const range = extractRange(req);
    const summary = await reportService.getDashboardSummary(branchId, range);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || "Failed to generate dashboard summary" },
    });
  }
});

/**
 * GET /api/reports/sales
 * Detailed sales report by period and recent invoices
 */
reportRouter.get("/sales", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const range = extractRange(req);
    const report = await reportService.getDetailedSalesReport(branchId, range);

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || "Failed to generate sales report" },
    });
  }
});

/**
 * GET /api/reports/top-items
 * Top-selling menu items by quantity or revenue
 */
reportRouter.get("/top-items", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const range = extractRange(req);
    const sortBy = req.query.sortBy === "quantity" ? "quantity" : "value";
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const report = await reportService.getTopSellingItems(branchId, range, sortBy, limit);

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || "Failed to generate top items report" },
    });
  }
});

/**
 * GET /api/reports/categories
 * Sales breakdown and performance by category
 */
reportRouter.get("/categories", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const range = extractRange(req);
    const report = await reportService.getCategoryPerformance(branchId, range);

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || "Failed to generate category report" },
    });
  }
});

/**
 * GET /api/reports/payments
 * Payments breakdown by tender and split-payment transactions
 */
reportRouter.get("/payments", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const range = extractRange(req);
    const report = await reportService.getPaymentMethodReport(branchId, range);

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || "Failed to generate payments report" },
    });
  }
});

/**
 * GET /api/reports/order-types
 * Takeaway vs Dine-In sales performance
 */
reportRouter.get("/order-types", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const range = extractRange(req);
    const report = await reportService.getOrderTypeReport(branchId, range);

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || "Failed to generate order types report" },
    });
  }
});

/**
 * GET /api/reports/taxes
 * Discounts and GST tax breakdowns
 */
reportRouter.get("/taxes", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const range = extractRange(req);
    const report = await reportService.getDiscountsAndTaxesReport(branchId, range);

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || "Failed to generate tax report" },
    });
  }
});

/**
 * GET /api/reports/inventory
 * Inventory consumption, stock intake, and wastage summary
 */
reportRouter.get("/inventory", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const range = extractRange(req);
    const report = await reportService.getInventoryReport(branchId, range);

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || "Failed to generate inventory report" },
    });
  }
});

/**
 * GET /api/reports/cash
 * Shift closings, cash flow, and discrepancy audit summary
 */
reportRouter.get("/cash", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const range = extractRange(req);
    const report = await reportService.getCashManagementReport(branchId, range);

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || "Failed to generate cash report" },
    });
  }
});

/**
 * GET /api/reports/export/:reportType
 * Export selected report into clean CSV format
 */
reportRouter.get("/export/:reportType", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const { reportType } = req.params;
    const range = extractRange(req);

    const { filename, csvContent } = await reportService.exportReportCSV(branchId, reportType, range);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message || "Failed to export report" },
    });
  }
});
