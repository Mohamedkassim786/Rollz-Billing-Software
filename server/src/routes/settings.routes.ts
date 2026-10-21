import { Router, Response } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { authenticate, AuthenticatedRequest, requireRoles } from "../middleware/auth.middleware";
import { printerService } from "../services/printer/printerService";
import { backupService } from "../services/backupService";
import { PrintDestinationType } from "../services/printer/printer.types";
import { env } from "../config/env";

export const settingsRouter = Router();

settingsRouter.use(authenticate);

// Settings schema for updating branch identity and hardware configurations
const updateSettingsSchema = z.object({
  name: z.string().trim().min(1).optional(),
  address: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  gstin: z.string().trim().nullable().optional(),
  taxMode: z.enum(["GST", "NON_GST"]).optional(),
  receiptHeader: z.string().trim().nullable().optional(),
  receiptFooter: z.string().trim().nullable().optional(),
  upiId: z.string().trim().nullable().optional(),
  upiPayeeName: z.string().trim().nullable().optional(),
  customerPrinterType: z.enum(["MOCK", "NETWORK_TCP"]).optional(),
  customerPrinterAddress: z.string().trim().nullable().optional(),
  customerPrinterPaperWidth: z.coerce.number().int().optional(),
  customerPrinterEnabled: z.boolean().optional(),
  kitchenPrinterType: z.enum(["MOCK", "NETWORK_TCP"]).optional(),
  kitchenPrinterAddress: z.string().trim().nullable().optional(),
  kitchenPrinterPaperWidth: z.coerce.number().int().optional(),
  kitchenPrinterEnabled: z.boolean().optional(),
});

/**
 * GET /api/settings
 * Fetch current restaurant configuration and hardware settings
 */
settingsRouter.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;

  try {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      res.status(404).json({ error: { message: "Branch not found" } });
      return;
    }

    const hostInfo = {
      host: env.HOST,
      port: env.PORT,
      database: "rollz_pos",
      pgToolsFound: backupService.isPgToolsAvailable(),
      pgBinDir: backupService.getPgBinDir(),
    };
    const backups = await backupService.listBackups();

    res.json({
      success: true,
      branch,
      hostInfo,
      backups,
      data: branch,
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message || "Failed to load settings" } });
  }
});

/**
 * PUT /api/settings
 * Update restaurant identity and printer configuration (OWNER / MANAGER only)
 */
settingsRouter.put("/", requireRoles([Role.OWNER, Role.MANAGER]), async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;

  const parseResult = updateSettingsSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid settings payload",
        details: parseResult.error.format(),
      },
    });
    return;
  }

  try {
    const updatedBranch = await prisma.branch.update({
      where: { id: branchId },
      data: parseResult.data,
    });

    res.json({
      success: true,
      message: "Restaurant settings saved successfully",
      branch: updatedBranch,
      data: updatedBranch,
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message || "Failed to save settings" } });
  }
});

/**
 * POST /api/settings/printers/test
 * Send a diagnostic test print to the configured printer
 */
settingsRouter.post(
  "/printers/test",
  requireRoles([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const branchId = req.user!.branchId;
    const destination = (req.body.destination || "CUSTOMER_RECEIPT") as PrintDestinationType;

    if (!["CUSTOMER_RECEIPT", "KITCHEN"].includes(destination)) {
      res.status(400).json({ error: { message: "Invalid destination type" } });
      return;
    }

    try {
      const result = await printerService.testPrint(destination, branchId);
      res.json({
        success: result.success,
        message: result.message,
        destination: result.destination,
        adapterName: result.adapterName,
        data: result,
      });
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message || "Test print failed" } });
    }
  }
);

/**
 * POST /api/settings/queue/recover
 * Recover stale print jobs interrupted by a crash or restart
 */
settingsRouter.post(
  "/queue/recover",
  requireRoles([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const branchId = req.user!.branchId;

    try {
      const result = await printerService.recoverStalePrintJobs(branchId);
      res.json({
        success: true,
        message: `Queue recovery complete: ${result.recoveredCount} jobs recovered, ${result.failedCount} marked failed`,
        recoveredCount: result.recoveredCount,
        failedCount: result.failedCount,
        data: result,
      });
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message || "Queue recovery failed" } });
    }
  }
);

/**
 * POST /api/settings/backup
 * Trigger an immediate PostgreSQL database backup using pg_dump
 */
settingsRouter.post(
  "/backup",
  requireRoles([Role.OWNER]),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await backupService.createBackup();

      if (result.success) {
        res.status(201).json({
          success: true,
          message: "Database backup created successfully",
          backup: result,
          data: result,
        });
      } else {
        res.status(500).json({
          success: false,
          error: { message: result.error || "Backup failed" },
          data: result,
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message || "Failed to trigger backup" } });
    }
  }
);

/**
 * GET /api/settings/backups
 * List all available backups
 */
settingsRouter.get(
  "/backups",
  requireRoles([Role.OWNER, Role.MANAGER]),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const backups = await backupService.listBackups();
      res.json({
        success: true,
        backups,
        data: backups,
      });
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message || "Failed to list backups" } });
    }
  }
);

/**
 * POST /api/settings/backup/restore
 * Safely verify or restore backup against a target test database
 */
settingsRouter.post(
  "/backup/restore",
  requireRoles([Role.OWNER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { backupFilePath, backupFilename, targetDatabase, confirmDatabaseName } = req.body;
    const pathOrFilename = backupFilePath || backupFilename;

    if (!pathOrFilename) {
      res.status(400).json({ error: { message: "backupFilename or backupFilePath is required" } });
      return;
    }

    try {
      const targetDb = targetDatabase || confirmDatabaseName || "rollz_pos_test";
      const result = await backupService.restoreBackup({
        backupFilePath,
        backupFilename,
        targetDatabase: targetDb,
      });

      res.json({
        success: result.success,
        message: `Restoration complete for ${result.targetDatabase}`,
        targetDatabase: result.targetDatabase,
        data: result,
      });
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message || "Restore verification failed" } });
    }
  }
);
