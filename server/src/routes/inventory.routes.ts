import { Router, Response } from "express";
import { Role } from "@prisma/client";
import { authenticate, requireRoles, AuthenticatedRequest } from "../middleware/auth.middleware";
import { inventoryService } from "../services/inventoryService";

export const inventoryRouter = Router();

// All inventory endpoints require authentication
inventoryRouter.use(authenticate);

/**
 * GET /api/inventory/dashboard
 * Summary metrics: active ingredients, low stock, out of stock, wastage, recent movements
 */
inventoryRouter.get("/dashboard", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const summary = await inventoryService.getDashboardSummary(branchId);
    res.json({
      success: true,
      data: summary,
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "DASHBOARD_ERROR", message: err.message || "Failed to fetch inventory dashboard" },
    });
  }
});

/**
 * GET /api/inventory/ingredients
 * List ingredients with optional filtering by category, search, stockStatus, isActive
 */
inventoryRouter.get("/ingredients", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const { search, category, stockStatus, isActive } = req.query;

    const ingredients = await inventoryService.getIngredients(branchId, {
      search: search as string,
      category: category as string,
      stockStatus: stockStatus as any,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
    });

    res.json({
      success: true,
      data: ingredients,
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "FETCH_ERROR", message: err.message || "Failed to fetch ingredients" },
    });
  }
});

/**
 * GET /api/inventory/ingredients/:id
 * Retrieve details of a single ingredient
 */
inventoryRouter.get("/ingredients/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const { id } = req.params;

    const ingredient = await inventoryService.getIngredientById(id, branchId);
    res.json({
      success: true,
      data: ingredient,
    });
  } catch (err: any) {
    res.status(err.message === "Ingredient not found" ? 404 : 500).json({
      error: { code: "NOT_FOUND", message: err.message },
    });
  }
});

/**
 * POST /api/inventory/ingredients
 * Create a new ingredient (OWNER and MANAGER only)
 */
inventoryRouter.post(
  "/ingredients",
  requireRoles([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const branchId = req.user!.branchId;
      const userId = req.user!.userId;
      const { name, sku, category, description, unit, currentStock, minThreshold, costPerUnit } = req.body;

      const created = await inventoryService.createIngredient(
        branchId,
        {
          name,
          sku,
          category,
          description,
          unit,
          currentStock,
          minThreshold,
          costPerUnit,
        },
        userId
      );

      res.status(201).json({
        success: true,
        data: created,
      });
    } catch (err: any) {
      const isConflict = err.message && err.message.includes("already exists");
      res.status(isConflict ? 409 : 400).json({
        error: { code: isConflict ? "SKU_EXISTS" : "INVALID_INPUT", message: err.message },
      });
    }
  }
);

/**
 * PATCH /api/inventory/ingredients/:id
 * Update ingredient metadata, threshold, or unit cost (OWNER and MANAGER only)
 */
inventoryRouter.patch(
  "/ingredients/:id",
  requireRoles([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const branchId = req.user!.branchId;
      const { id } = req.params;

      const updated = await inventoryService.updateIngredient(id, branchId, req.body);
      res.json({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      const isConflict = err.message && err.message.includes("already exists");
      res.status(isConflict ? 409 : 400).json({
        error: { code: isConflict ? "SKU_EXISTS" : "UPDATE_ERROR", message: err.message },
      });
    }
  }
);

/**
 * PATCH /api/inventory/ingredients/:id/status
 * Activate or deactivate an ingredient (OWNER and MANAGER only)
 */
inventoryRouter.patch(
  "/ingredients/:id/status",
  requireRoles([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const branchId = req.user!.branchId;
      const { id } = req.params;
      const { isActive } = req.body;

      if (isActive === undefined) {
        res.status(400).json({
          error: { code: "INVALID_INPUT", message: "isActive boolean is required" },
        });
        return;
      }

      const updated = await inventoryService.toggleIngredientStatus(id, branchId, Boolean(isActive));
      res.json({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      res.status(400).json({
        error: { code: "STATUS_UPDATE_ERROR", message: err.message },
      });
    }
  }
);

/**
 * POST /api/inventory/intake
 * Record supplier purchase stock intake (OWNER and MANAGER only)
 */
inventoryRouter.post(
  "/intake",
  requireRoles([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const branchId = req.user!.branchId;
      const userId = req.user!.userId;
      const idempotencyKey = (req.headers["x-idempotency-key"] as string) || req.body.idempotencyKey;

      const result = await inventoryService.recordStockIntake(branchId, userId, {
        ...req.body,
        idempotencyKey,
      });

      res.status(result.isDuplicate ? 200 : 201).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      res.status(400).json({
        error: { code: "INTAKE_ERROR", message: err.message },
      });
    }
  }
);

/**
 * POST /api/inventory/wastage
 * Record spoiled, expired, or damaged stock (OWNER and MANAGER only)
 */
inventoryRouter.post(
  "/wastage",
  requireRoles([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const branchId = req.user!.branchId;
      const userId = req.user!.userId;

      const result = await inventoryService.recordWastage(branchId, userId, req.body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      res.status(400).json({
        error: { code: "WASTAGE_ERROR", message: err.message },
      });
    }
  }
);

/**
 * POST /api/inventory/adjustment
 * Record stock correction / audit adjustment (OWNER and MANAGER only)
 */
inventoryRouter.post(
  "/adjustment",
  requireRoles([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const branchId = req.user!.branchId;
      const userId = req.user!.userId;

      const result = await inventoryService.recordAdjustment(branchId, userId, req.body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      res.status(400).json({
        error: { code: "ADJUSTMENT_ERROR", message: err.message },
      });
    }
  }
);

/**
 * GET /api/inventory/movements
 * Auditable inventory movement ledger
 */
inventoryRouter.get("/movements", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const { ingredientId, type, startDate, endDate, page, limit, search } = req.query;

    const result = await inventoryService.getMovements(branchId, {
      ingredientId: ingredientId as string,
      type: type as any,
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 25,
      search: search as string,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "MOVEMENTS_ERROR", message: err.message },
    });
  }
});

/**
 * GET /api/inventory/intakes
 * List supplier stock intakes
 */
inventoryRouter.get("/intakes", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const { ingredientId, page, limit } = req.query;

    const result = await inventoryService.getIntakes(branchId, {
      ingredientId: ingredientId as string,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 25,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "INTAKES_ERROR", message: err.message },
    });
  }
});

/**
 * GET /api/inventory/recipes/menu-items/:menuItemId
 * Get configured recipe and estimated cost for a menu item
 */
inventoryRouter.get(
  "/recipes/menu-items/:menuItemId",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const branchId = req.user!.branchId;
      const { menuItemId } = req.params;

      const recipe = await inventoryService.getMenuItemRecipe(menuItemId, branchId);
      res.json({
        success: true,
        data: recipe,
      });
    } catch (err: any) {
      res.status(err.message.includes("not found") ? 404 : 500).json({
        error: { code: "RECIPE_ERROR", message: err.message },
      });
    }
  }
);

/**
 * PUT /api/inventory/recipes/menu-items/:menuItemId
 * Save / replace recipe ingredients for a menu item (OWNER and MANAGER only)
 */
inventoryRouter.put(
  "/recipes/menu-items/:menuItemId",
  requireRoles([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const branchId = req.user!.branchId;
      const { menuItemId } = req.params;
      const { items } = req.body;

      if (!Array.isArray(items)) {
        res.status(400).json({
          error: { code: "INVALID_INPUT", message: "items must be an array of recipe ingredients" },
        });
        return;
      }

      const updated = await inventoryService.setMenuItemRecipe(menuItemId, branchId, items);
      res.json({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      res.status(400).json({
        error: { code: "RECIPE_SAVE_ERROR", message: err.message },
      });
    }
  }
);

/**
 * POST /api/inventory/check-availability
 * Pre-check cart items against inventory (Accessible by CASHIER, MANAGER, OWNER)
 */
inventoryRouter.post(
  "/check-availability",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const branchId = req.user!.branchId;
      const { items } = req.body;

      if (!Array.isArray(items)) {
        res.status(400).json({
          error: { code: "INVALID_INPUT", message: "items array is required" },
        });
        return;
      }

      const check = await inventoryService.checkItemsAvailability(branchId, items);
      res.json({
        success: true,
        data: check,
      });
    } catch (err: any) {
      res.status(500).json({
        error: { code: "AVAILABILITY_ERROR", message: err.message },
      });
    }
  }
);
