import { Router, Response } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { authenticate, AuthenticatedRequest, requireRoles } from "../middleware/auth.middleware";
import { printerService } from "../services/printer/printerService";
import { discoverPrinterDevices } from "../services/printer/printerDiscovery";
import { backupService } from "../services/backupService";
import { PrintDestinationType } from "../services/printer/printer.types";
import { env } from "../config/env";
import { brandingUpload, deleteBrandingImage } from "../utils/fileUpload";

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
  tagline: z.string().trim().nullable().optional(),
  logoPath: z.string().trim().nullable().optional(),
  loginBgPath: z.string().trim().nullable().optional(),
  customerPrinterType: z.enum(["MOCK", "NETWORK_TCP", "USB", "BLUETOOTH"]).optional(),
  customerPrinterAddress: z.string().trim().nullable().optional(),
  customerPrinterPaperWidth: z.coerce.number().int().optional(),
  customerPrinterEnabled: z.boolean().optional(),
  kitchenPrinterType: z.enum(["MOCK", "NETWORK_TCP", "USB", "BLUETOOTH"]).optional(),
  kitchenPrinterAddress: z.string().trim().nullable().optional(),
  kitchenPrinterPaperWidth: z.coerce.number().int().optional(),
  kitchenPrinterEnabled: z.boolean().optional(),
  upiAutoVerifyEnabled: z.boolean().optional(),
  upiWebhookSecret: z.string().trim().nullable().optional(),
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
 * POST /api/settings/logo
 * Upload restaurant logo (replaces default logo across POS)
 */
settingsRouter.post(
  "/logo",
  requireRoles([Role.OWNER, Role.MANAGER]),
  brandingUpload.single("logo"),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: { message: "No logo image file uploaded" } });
      return;
    }

    const branchId = req.user!.branchId;
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });

    // Clean up previous custom logo if one existed
    if (branch && (branch as any).logoPath) {
      deleteBrandingImage((branch as any).logoPath);
    }

    const logoPath = `/uploads/branding/${req.file.filename}`;
    const updated = await prisma.branch.update({
      where: { id: branchId },
      data: { logoPath } as any,
    });

    res.json({
      success: true,
      logoPath,
      branch: updated,
      message: "Restaurant logo updated successfully!",
    });
  }
);

/**
 * DELETE /api/settings/logo
 * Reset logo back to default Rollz logo
 */
settingsRouter.delete(
  "/logo",
  requireRoles([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const branchId = req.user!.branchId;
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });

    if (branch && (branch as any).logoPath) {
      deleteBrandingImage((branch as any).logoPath);
    }

    const updated = await prisma.branch.update({
      where: { id: branchId },
      data: { logoPath: null } as any,
    });

    res.json({
      success: true,
      branch: updated,
      message: "Logo reset to default successfully",
    });
  }
);

/**
 * POST /api/settings/login-bg
 * Upload custom background wallpaper for login page
 */
settingsRouter.post(
  "/login-bg",
  requireRoles([Role.OWNER, Role.MANAGER]),
  brandingUpload.single("loginBg"),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: { message: "No background image file uploaded" } });
      return;
    }

    const branchId = req.user!.branchId;
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });

    if (branch && (branch as any).loginBgPath) {
      deleteBrandingImage((branch as any).loginBgPath);
    }

    const loginBgPath = `/uploads/branding/${req.file.filename}`;
    const updated = await prisma.branch.update({
      where: { id: branchId },
      data: { loginBgPath } as any,
    });

    res.json({
      success: true,
      loginBgPath,
      branch: updated,
      message: "Login screen wallpaper updated successfully!",
    });
  }
);

/**
 * DELETE /api/settings/login-bg
 * Reset login wallpaper back to default
 */
settingsRouter.delete(
  "/login-bg",
  requireRoles([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const branchId = req.user!.branchId;
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });

    if (branch && (branch as any).loginBgPath) {
      deleteBrandingImage((branch as any).loginBgPath);
    }

    const updated = await prisma.branch.update({
      where: { id: branchId },
      data: { loginBgPath: null } as any,
    });

    res.json({
      success: true,
      branch: updated,
      message: "Login wallpaper reset to default",
    });
  }
);

/**
 * GET /api/settings/printers/devices
 * Discover available local printers and serial COM ports
 */
settingsRouter.get(
  "/printers/devices",
  requireRoles([Role.OWNER, Role.MANAGER]),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const devices = await discoverPrinterDevices();
      res.json({
        success: true,
        ...devices,
      });
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message || "Failed to discover printer devices" } });
    }
  }
);

/**
 * POST /api/settings/printers/test
 * Send a diagnostic test print to the configured printer
 */
settingsRouter.post(
  "/printers/test",
  requireRoles([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const branchId = req.user!.branchId;
    const { destination = "CUSTOMER_RECEIPT", printerType, printerAddress, paperWidth } = req.body;

    if (!["CUSTOMER_RECEIPT", "KITCHEN"].includes(destination)) {
      res.status(400).json({ error: { message: "Invalid destination type" } });
      return;
    }

    try {
      const result = await printerService.testPrint(destination as PrintDestinationType, branchId, prisma, {
        printerType,
        printerAddress,
        paperWidth: paperWidth ? Number(paperWidth) : undefined,
      });
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
