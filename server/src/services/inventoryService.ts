import { prisma } from "../config/prisma";
import { convertQuantity, areUnitsCompatible, normalizeUnit } from "../utils/unitConverter";
import { calculateStockStatus, StockStatus } from "../utils/stockUtils";
import { StockMovementType } from "@prisma/client";

export interface CreateIngredientInput {
  name: string;
  sku: string;
  category?: string;
  description?: string;
  unit: string;
  currentStock?: number;
  minThreshold?: number;
  costPerUnit?: number; // Integer paise
}

export interface UpdateIngredientInput {
  name?: string;
  sku?: string;
  category?: string;
  description?: string;
  unit?: string;
  minThreshold?: number;
  costPerUnit?: number;
  isActive?: boolean;
}

export interface RecordStockIntakeInput {
  ingredientId: string;
  quantity: number;
  unit: string;
  purchaseCost: number; // Integer paise
  supplierName?: string;
  invoiceRef?: string;
  receivedDate?: string | Date;
  notes?: string;
  idempotencyKey?: string;
}

export interface RecordWastageInput {
  ingredientId: string;
  quantity: number;
  unit: string;
  reason: string;
  notes?: string;
}

export interface RecordAdjustmentInput {
  ingredientId: string;
  newQuantity: number;
  unit?: string;
  reason: string;
  notes?: string;
}

export interface RecipeItemInput {
  ingredientId: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export class InventoryService {
  /**
   * Get Inventory Dashboard Summary metrics
   */
  public async getDashboardSummary(branchId: string, clientDb?: any) {
    const db = clientDb || prisma;

    const ingredients = await db.ingredient.findMany({
      where: { branchId, isActive: true },
    });

    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalValuationPaise = 0;

    for (const ing of ingredients) {
      const status = calculateStockStatus(ing.currentStock, ing.minThreshold);
      if (status === "OUT_OF_STOCK") {
        outOfStockCount++;
      } else if (status === "LOW_STOCK") {
        lowStockCount++;
      }
      if (ing.currentStock > 0 && ing.costPerUnit > 0) {
        totalValuationPaise += Math.round(ing.currentStock * ing.costPerUnit);
      }
    }

    const wastageMovements = await db.stockMovement.findMany({
      where: { branchId, type: "WASTAGE" },
    });

    const recentMovements = await db.stockMovement.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        ingredient: { select: { id: true, name: true, sku: true, unit: true } },
        user: { select: { id: true, displayName: true } },
      },
    });

    return {
      totalActiveIngredients: ingredients.length,
      lowStockCount,
      outOfStockCount,
      totalWastageCount: wastageMovements.length,
      totalInventoryValuation: totalValuationPaise,
      recentMovements,
    };
  }

  /**
   * List ingredients with optional filtering, search, and pagination
   */
  public async getIngredients(
    branchId: string,
    query: {
      search?: string;
      category?: string;
      stockStatus?: StockStatus;
      isActive?: boolean;
    } = {},
    clientDb?: any
  ) {
    const db = clientDb || prisma;

    const where: any = { branchId };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.category && query.category !== "ALL") {
      where.category = query.category;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { sku: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const rawIngredients = await db.ingredient.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            recipeIngredients: true,
            modifierRecipeIngredients: true,
            stockMovements: true,
          },
        },
      },
    });

    // Map each ingredient with computed stockStatus
    const mapped = rawIngredients.map((ing: any) => {
      const stockStatus = calculateStockStatus(ing.currentStock, ing.minThreshold);
      return {
        ...ing,
        stockStatus,
        recipeCount: ing._count.recipeIngredients + ing._count.modifierRecipeIngredients,
        movementCount: ing._count.stockMovements,
      };
    });

    if (query.stockStatus) {
      return mapped.filter((i: any) => i.stockStatus === query.stockStatus);
    }

    return mapped;
  }

  /**
   * Get single ingredient with recent movements and recipe references
   */
  public async getIngredientById(id: string, branchId: string, clientDb?: any) {
    const db = clientDb || prisma;

    const ingredient = await db.ingredient.findFirst({
      where: { id, branchId },
      include: {
        stockMovements: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            user: { select: { id: true, displayName: true } },
          },
        },
        recipeIngredients: {
          include: {
            menuItem: { select: { id: true, name: true, basePrice: true } },
          },
        },
      },
    });

    if (!ingredient) {
      throw new Error("Ingredient not found");
    }

    return {
      ...ingredient,
      stockStatus: calculateStockStatus(ingredient.currentStock, ingredient.minThreshold),
    };
  }

  /**
   * Create a new ingredient
   */
  public async createIngredient(branchId: string, input: CreateIngredientInput, userId?: string, clientDb?: any) {
    const db = clientDb || prisma;

    const trimmedName = (input.name || "").trim();
    const trimmedSku = (input.sku || "").trim().toUpperCase();

    if (!trimmedName) {
      throw new Error("Ingredient name is required");
    }
    if (!trimmedSku) {
      throw new Error("Ingredient SKU is required");
    }
    if (!input.unit) {
      throw new Error("Unit of measurement is required");
    }

    const normUnit = normalizeUnit(input.unit);
    const initialStock = Number(input.currentStock || 0);
    const threshold = Number(input.minThreshold || 0);
    const unitCost = Math.round(Number(input.costPerUnit || 0));

    if (initialStock < 0) {
      throw new Error("Initial stock cannot be negative");
    }
    if (threshold < 0) {
      throw new Error("Minimum stock threshold cannot be negative");
    }
    if (unitCost < 0) {
      throw new Error("Cost per unit cannot be negative");
    }

    // Check SKU uniqueness in branch
    const existingSku = await db.ingredient.findUnique({
      where: {
        branchId_sku: { branchId, sku: trimmedSku },
      },
    });

    if (existingSku) {
      throw new Error(`An ingredient with SKU "${trimmedSku}" already exists in this branch`);
    }

    return await db.$transaction(async (tx: any) => {
      const created = await tx.ingredient.create({
        data: {
          branchId,
          name: trimmedName,
          sku: trimmedSku,
          category: input.category?.trim() || "General",
          description: input.description?.trim() || null,
          unit: normUnit,
          currentStock: initialStock,
          minThreshold: threshold,
          costPerUnit: unitCost,
          isActive: true,
        },
      });

      // If initial stock was provided, record an initial STOCK_IN movement for audit trail
      if (initialStock > 0) {
        await tx.stockMovement.create({
          data: {
            branchId,
            ingredientId: created.id,
            type: "STOCK_IN",
            quantity: initialStock,
            unit: normUnit,
            stockBefore: 0,
            stockAfter: initialStock,
            userId: userId || null,
            reason: "Initial stock intake on creation",
          },
        });
      }

      return {
        ...created,
        stockStatus: calculateStockStatus(created.currentStock, created.minThreshold),
      };
    });
  }

  /**
   * Update an existing ingredient's metadata, threshold, or unit cost.
   * Note: Current stock must be updated through intake, wastage, or adjustment.
   */
  public async updateIngredient(
    id: string,
    branchId: string,
    input: UpdateIngredientInput,
    clientDb?: any
  ) {
    const db = clientDb || prisma;

    const existing = await db.ingredient.findFirst({
      where: { id, branchId },
    });

    if (!existing) {
      throw new Error("Ingredient not found");
    }

    const updateData: any = {};

    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (!trimmed) throw new Error("Ingredient name cannot be empty");
      updateData.name = trimmed;
    }

    if (input.sku !== undefined) {
      const trimmedSku = input.sku.trim().toUpperCase();
      if (!trimmedSku) throw new Error("Ingredient SKU cannot be empty");
      if (trimmedSku !== existing.sku) {
        const skuConflict = await db.ingredient.findUnique({
          where: { branchId_sku: { branchId, sku: trimmedSku } },
        });
        if (skuConflict && skuConflict.id !== id) {
          throw new Error(`An ingredient with SKU "${trimmedSku}" already exists in this branch`);
        }
        updateData.sku = trimmedSku;
      }
    }

    if (input.category !== undefined) {
      updateData.category = input.category.trim() || "General";
    }

    if (input.description !== undefined) {
      updateData.description = input.description?.trim() || null;
    }

    if (input.unit !== undefined) {
      const normUnit = normalizeUnit(input.unit);
      if (!areUnitsCompatible(existing.unit, normUnit)) {
        throw new Error(
          `Cannot change unit from "${existing.unit}" to incompatible unit "${input.unit}". Create a new ingredient or adjust via inventory conversion.`
        );
      }
      updateData.unit = normUnit;
    }

    if (input.minThreshold !== undefined) {
      const threshold = Number(input.minThreshold);
      if (threshold < 0) throw new Error("Minimum threshold cannot be negative");
      updateData.minThreshold = threshold;
    }

    if (input.costPerUnit !== undefined) {
      const cost = Math.round(Number(input.costPerUnit));
      if (cost < 0) throw new Error("Cost per unit cannot be negative");
      updateData.costPerUnit = cost;
    }

    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
    }

    const updated = await db.ingredient.update({
      where: { id },
      data: updateData,
    });

    return {
      ...updated,
      stockStatus: calculateStockStatus(updated.currentStock, updated.minThreshold),
    };
  }

  /**
   * Toggle ingredient active status (soft-delete / activation)
   */
  public async toggleIngredientStatus(id: string, branchId: string, isActive: boolean, clientDb?: any) {
    const db = clientDb || prisma;

    const existing = await db.ingredient.findFirst({
      where: { id, branchId },
    });

    if (!existing) {
      throw new Error("Ingredient not found");
    }

    const updated = await db.ingredient.update({
      where: { id },
      data: { isActive },
    });

    return {
      ...updated,
      stockStatus: calculateStockStatus(updated.currentStock, updated.minThreshold),
    };
  }

  /**
   * Record Stock Intake (purchases from suppliers)
   */
  public async recordStockIntake(
    branchId: string,
    userId: string,
    input: RecordStockIntakeInput,
    clientDb?: any
  ) {
    const db = clientDb || prisma;

    const {
      ingredientId,
      quantity,
      unit,
      purchaseCost,
      supplierName,
      invoiceRef,
      receivedDate,
      notes,
      idempotencyKey,
    } = input;

    if (!quantity || quantity <= 0) {
      throw new Error("Intake quantity must be greater than zero");
    }

    if (purchaseCost === undefined || purchaseCost === null || purchaseCost < 0) {
      throw new Error("Purchase cost must be a non-negative integer in paise");
    }

    // Idempotency check
    if (idempotencyKey) {
      const existing = await db.stockIntake.findUnique({
        where: { idempotencyKey },
        include: { ingredient: true },
      });
      if (existing) {
        return {
          intake: existing,
          ingredient: existing.ingredient,
          isDuplicate: true,
        };
      }
    }

    const ingredient = await db.ingredient.findFirst({
      where: { id: ingredientId, branchId },
    });

    if (!ingredient) {
      throw new Error("Ingredient not found in this branch");
    }

    // Check unit compatibility and convert to ingredient base storage unit
    let convertedQuantity: number;
    try {
      convertedQuantity = convertQuantity(quantity, unit, ingredient.unit);
    } catch (err: any) {
      throw new Error(`Invalid intake unit: ${err.message}`);
    }

    return await db.$transaction(async (tx: any) => {
      const intakeRecord = await tx.stockIntake.create({
        data: {
          branchId,
          ingredientId: ingredient.id,
          quantity,
          unit: normalizeUnit(unit),
          purchaseCost: Math.round(purchaseCost),
          supplierName: supplierName?.trim() || null,
          invoiceRef: invoiceRef?.trim() || null,
          receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
          notes: notes?.trim() || null,
          userId,
          idempotencyKey: idempotencyKey || null,
        },
      });

      const stockBefore = ingredient.currentStock;
      const stockAfter = Math.round((stockBefore + convertedQuantity) * 10000) / 10000;

      // Calculate unit cost in paise based on this purchase
      const latestUnitCost = convertedQuantity > 0 ? Math.round(purchaseCost / convertedQuantity) : ingredient.costPerUnit;

      const updatedIngredient = await tx.ingredient.update({
        where: { id: ingredient.id },
        data: {
          currentStock: stockAfter,
          costPerUnit: latestUnitCost > 0 ? latestUnitCost : ingredient.costPerUnit,
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          branchId,
          ingredientId: ingredient.id,
          type: "STOCK_IN",
          quantity: convertedQuantity,
          unit: ingredient.unit,
          stockBefore,
          stockAfter,
          userId,
          reason: invoiceRef ? `Supplier Intake (${invoiceRef})` : "Stock purchase intake",
          notes: notes?.trim() || null,
        },
      });

      return {
        intake: intakeRecord,
        ingredient: {
          ...updatedIngredient,
          stockStatus: calculateStockStatus(updatedIngredient.currentStock, updatedIngredient.minThreshold),
        },
        movement,
      };
    });
  }

  /**
   * Record Stock Wastage (spoilage, damage, expiration)
   */
  public async recordWastage(
    branchId: string,
    userId: string,
    input: RecordWastageInput,
    clientDb?: any
  ) {
    const db = clientDb || prisma;

    const { ingredientId, quantity, unit, reason, notes } = input;

    if (!quantity || quantity <= 0) {
      throw new Error("Wastage quantity must be greater than zero");
    }

    if (!reason || !reason.trim()) {
      throw new Error("Wastage reason is required (e.g. SPOILED, EXPIRED, DAMAGED)");
    }

    const ingredient = await db.ingredient.findFirst({
      where: { id: ingredientId, branchId },
    });

    if (!ingredient) {
      throw new Error("Ingredient not found in this branch");
    }

    let convertedQuantity: number;
    try {
      convertedQuantity = convertQuantity(quantity, unit, ingredient.unit);
    } catch (err: any) {
      throw new Error(`Invalid wastage unit: ${err.message}`);
    }

    if (convertedQuantity > ingredient.currentStock) {
      throw new Error(
        `Wastage quantity (${convertedQuantity} ${ingredient.unit}) cannot exceed available current stock (${ingredient.currentStock} ${ingredient.unit})`
      );
    }

    return await db.$transaction(async (tx: any) => {
      const stockBefore = ingredient.currentStock;
      const stockAfter = Math.round((stockBefore - convertedQuantity) * 10000) / 10000;

      const updatedIngredient = await tx.ingredient.update({
        where: { id: ingredient.id },
        data: {
          currentStock: stockAfter,
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          branchId,
          ingredientId: ingredient.id,
          type: "WASTAGE",
          quantity: convertedQuantity,
          unit: ingredient.unit,
          stockBefore,
          stockAfter,
          userId,
          reason: reason.trim(),
          notes: notes?.trim() || null,
        },
      });

      return {
        ingredient: {
          ...updatedIngredient,
          stockStatus: calculateStockStatus(updatedIngredient.currentStock, updatedIngredient.minThreshold),
        },
        movement,
      };
    });
  }

  /**
   * Record Stock Adjustment (audits, stock-takes, count corrections)
   */
  public async recordAdjustment(
    branchId: string,
    userId: string,
    input: RecordAdjustmentInput,
    clientDb?: any
  ) {
    const db = clientDb || prisma;

    const { ingredientId, newQuantity, unit, reason, notes } = input;

    if (newQuantity === undefined || newQuantity === null || newQuantity < 0) {
      throw new Error("New stock quantity must be a non-negative number");
    }

    if (!reason || !reason.trim()) {
      throw new Error("Adjustment reason is required (e.g. INVENTORY_COUNT, CORRECTION)");
    }

    const ingredient = await db.ingredient.findFirst({
      where: { id: ingredientId, branchId },
    });

    if (!ingredient) {
      throw new Error("Ingredient not found in this branch");
    }

    let convertedNewStock: number;
    try {
      convertedNewStock = unit ? convertQuantity(newQuantity, unit, ingredient.unit) : newQuantity;
    } catch (err: any) {
      throw new Error(`Invalid adjustment unit: ${err.message}`);
    }

    return await db.$transaction(async (tx: any) => {
      const stockBefore = ingredient.currentStock;
      const stockAfter = Math.round(convertedNewStock * 10000) / 10000;
      const delta = Math.round((stockAfter - stockBefore) * 10000) / 10000;

      const updatedIngredient = await tx.ingredient.update({
        where: { id: ingredient.id },
        data: {
          currentStock: stockAfter,
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          branchId,
          ingredientId: ingredient.id,
          type: "STOCK_ADJUSTMENT",
          quantity: Math.abs(delta),
          unit: ingredient.unit,
          stockBefore,
          stockAfter,
          userId,
          reason: reason.trim(),
          notes: notes ? `${notes} (Delta: ${delta > 0 ? "+" : ""}${delta} ${ingredient.unit})` : `Adjusted from ${stockBefore} to ${stockAfter} ${ingredient.unit}`,
        },
      });

      return {
        ingredient: {
          ...updatedIngredient,
          stockStatus: calculateStockStatus(updatedIngredient.currentStock, updatedIngredient.minThreshold),
        },
        movement,
      };
    });
  }

  /**
   * Get Stock Movement Ledger with filters and pagination
   */
  public async getMovements(
    branchId: string,
    query: {
      ingredientId?: string;
      type?: StockMovementType;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
      search?: string;
    } = {},
    clientDb?: any
  ) {
    const db = clientDb || prisma;

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
    const skip = (page - 1) * limit;

    const where: any = { branchId };

    if (query.ingredientId) {
      where.ingredientId = query.ingredientId;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    if (query.search) {
      where.OR = [
        { reason: { contains: query.search, mode: "insensitive" } },
        { notes: { contains: query.search, mode: "insensitive" } },
        { ingredient: { name: { contains: query.search, mode: "insensitive" } } },
        { ingredient: { sku: { contains: query.search, mode: "insensitive" } } },
      ];
    }

    const [total, movements] = await Promise.all([
      db.stockMovement.count({ where }),
      db.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          ingredient: { select: { id: true, name: true, sku: true, unit: true, category: true } },
          user: { select: { id: true, displayName: true, username: true } },
          order: { select: { id: true, orderNumber: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      }),
    ]);

    return {
      movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get Stock Intake History
   */
  public async getIntakes(
    branchId: string,
    query: {
      ingredientId?: string;
      page?: number;
      limit?: number;
    } = {},
    clientDb?: any
  ) {
    const db = clientDb || prisma;

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
    const skip = (page - 1) * limit;

    const where: any = { branchId };
    if (query.ingredientId) where.ingredientId = query.ingredientId;

    const [total, intakes] = await Promise.all([
      db.stockIntake.count({ where }),
      db.stockIntake.findMany({
        where,
        orderBy: { receivedDate: "desc" },
        skip,
        take: limit,
        include: {
          ingredient: { select: { id: true, name: true, sku: true, unit: true } },
          user: { select: { id: true, displayName: true } },
        },
      }),
    ]);

    return {
      intakes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Recipe Management: Get configured recipe for a menu item
   */
  public async getMenuItemRecipe(menuItemId: string, branchId: string, clientDb?: any) {
    const db = clientDb || prisma;

    const menuItem = await db.menuItem.findFirst({
      where: { id: menuItemId, branchId },
      include: {
        category: true,
        recipeIngredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (!menuItem) {
      throw new Error("Menu item not found in this branch");
    }

    let estimatedCostPaise = 0;
    const items = menuItem.recipeIngredients.map((ri: any) => {
      let portionCost = 0;
      try {
        const converted = convertQuantity(ri.quantity, ri.unit, ri.ingredient.unit);
        portionCost = Math.round(converted * ri.ingredient.costPerUnit);
        estimatedCostPaise += portionCost;
      } catch {
        // If unit conversion is invalid, cost is not added
      }

      return {
        id: ri.id,
        ingredientId: ri.ingredientId,
        ingredientName: ri.ingredient.name,
        ingredientSku: ri.ingredient.sku,
        ingredientCategory: ri.ingredient.category,
        recipeQuantity: ri.quantity,
        recipeUnit: ri.unit,
        ingredientUnit: ri.ingredient.unit,
        costPerUnit: ri.ingredient.costPerUnit,
        portionCost,
        notes: ri.notes,
        currentStock: ri.ingredient.currentStock,
        stockStatus: calculateStockStatus(ri.ingredient.currentStock, ri.ingredient.minThreshold),
      };
    });

    return {
      menuItem: {
        id: menuItem.id,
        name: menuItem.name,
        basePrice: menuItem.basePrice,
        category: menuItem.category.name,
      },
      recipeItems: items,
      estimatedCostPaise,
    };
  }

  /**
   * Recipe Management: Save / update recipe for a menu item
   */
  public async setMenuItemRecipe(
    menuItemId: string,
    branchId: string,
    items: RecipeItemInput[],
    clientDb?: any
  ) {
    const db = clientDb || prisma;

    const menuItem = await db.menuItem.findFirst({
      where: { id: menuItemId, branchId },
    });

    if (!menuItem) {
      throw new Error("Menu item not found in this branch");
    }

    // Validate all ingredients and units
    for (const item of items) {
      if (!item.quantity || item.quantity <= 0) {
        throw new Error("Recipe ingredient quantity must be greater than zero");
      }
      const ing = await db.ingredient.findFirst({
        where: { id: item.ingredientId, branchId },
      });
      if (!ing) {
        throw new Error(`Ingredient with ID ${item.ingredientId} does not exist in this branch`);
      }
      if (!areUnitsCompatible(item.unit, ing.unit)) {
        throw new Error(
          `Unit "${item.unit}" for ingredient "${ing.name}" is incompatible with stored unit "${ing.unit}"`
        );
      }
    }

    return await db.$transaction(async (tx: any) => {
      // Clear existing recipe ingredients for this menu item
      await tx.recipeIngredient.deleteMany({
        where: { menuItemId },
      });

      // Insert new recipe ingredients
      for (const item of items) {
        await tx.recipeIngredient.create({
          data: {
            branchId,
            menuItemId,
            ingredientId: item.ingredientId,
            quantity: item.quantity,
            unit: normalizeUnit(item.unit),
            notes: item.notes?.trim() || null,
          },
        });
      }

      return await this.getMenuItemRecipe(menuItemId, branchId, tx);
    });
  }

  /**
   * Pre-check availability for a set of items (used by POS terminal)
   */
  public async checkItemsAvailability(
    branchId: string,
    items: Array<{ menuItemId: string; quantity: number }>,
    clientDb?: any
  ) {
    const db = clientDb || prisma;

    const warnings: Array<{
      menuItemId: string;
      ingredientName: string;
      required: number;
      available: number;
      unit: string;
      status: StockStatus;
    }> = [];

    // Aggregate ingredient requirements
    const requirementMap: Record<string, { required: number; unit: string; name: string }> = {};

    for (const item of items) {
      const recipes = await db.recipeIngredient.findMany({
        where: { menuItemId: item.menuItemId, branchId },
        include: { ingredient: true },
      });

      for (const r of recipes) {
        const converted = convertQuantity(r.quantity * item.quantity, r.unit, r.ingredient.unit);
        if (!requirementMap[r.ingredientId]) {
          requirementMap[r.ingredientId] = {
            required: 0,
            unit: r.ingredient.unit,
            name: r.ingredient.name,
          };
        }
        requirementMap[r.ingredientId].required += converted;
      }
    }

    for (const [ingredientId, req] of Object.entries(requirementMap)) {
      const ing = await db.ingredient.findUnique({ where: { id: ingredientId } });
      if (ing) {
        const remaining = ing.currentStock - req.required;
        const status = calculateStockStatus(remaining, ing.minThreshold);
        if (remaining <= ing.minThreshold) {
          warnings.push({
            menuItemId: "",
            ingredientName: req.name,
            required: Math.round(req.required * 100) / 100,
            available: ing.currentStock,
            unit: req.unit,
            status,
          });
        }
      }
    }

    return {
      hasWarnings: warnings.length > 0,
      warnings,
    };
  }

  /**
   * CRITICAL INVARIANT: Automatic Stock Deduction for Finalized & Paid Order.
   * Runs inside the order payment atomic database transaction!
   * Deducts configured ingredients strictly once per confirmed order.
   */
  public async deductStockForFinalizedOrder(
    orderId: string,
    branchId: string,
    invoiceId: string,
    cashierId: string,
    tx: any
  ) {
    // 1. Idempotency Check: verify if stock has already been deducted for this order
    const existingDeduction = await tx.stockMovement.findFirst({
      where: {
        orderId,
        type: "SALE_DEDUCTION",
      },
    });

    if (existingDeduction) {
      console.log(`[Inventory] Order ${orderId} has already had stock deducted. Skipping to prevent duplicate.`);
      return { alreadyDeducted: true };
    }

    // 2. Fetch order items with menuItemId
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order || !order.items || order.items.length === 0) {
      return { deducted: 0 };
    }

    // 3. Aggregate ingredient consumption across all order items
    // Map: ingredientId => totalQuantityInIngredientUnit
    const consumptionMap: Record<
      string,
      {
        ingredientId: string;
        totalDeduction: number;
        ingredientUnit: string;
      }
    > = {};

    for (const item of order.items) {
      if (!item.menuItemId) continue;

      // Query recipe ingredients for this menu item
      const recipeIngredients = await tx.recipeIngredient.findMany({
        where: { menuItemId: item.menuItemId, branchId },
        include: { ingredient: true },
      });

      for (const recipeItem of recipeIngredients) {
        const { ingredient } = recipeItem;
        if (!ingredient) continue;

        // Convert recipe quantity * item.quantity to ingredient storage unit
        let deduction = 0;
        try {
          deduction = convertQuantity(
            recipeItem.quantity * item.quantity,
            recipeItem.unit,
            ingredient.unit
          );
        } catch (err: any) {
          console.warn(`[Inventory] Unit conversion error for recipe item ${recipeItem.id}:`, err.message);
          continue;
        }

        if (!consumptionMap[ingredient.id]) {
          consumptionMap[ingredient.id] = {
            ingredientId: ingredient.id,
            totalDeduction: 0,
            ingredientUnit: ingredient.unit,
          };
        }
        consumptionMap[ingredient.id].totalDeduction += deduction;
      }
    }

    // 4. Atomically apply deductions and create audit trail stock movements
    const movements = [];
    for (const entry of Object.values(consumptionMap)) {
      if (entry.totalDeduction <= 0) continue;

      const ingredient = await tx.ingredient.findUnique({
        where: { id: entry.ingredientId },
      });

      if (!ingredient) continue;

      const stockBefore = ingredient.currentStock;
      const stockAfter = Math.round((stockBefore - entry.totalDeduction) * 10000) / 10000;

      await tx.ingredient.update({
        where: { id: ingredient.id },
        data: { currentStock: stockAfter },
      });

      const movement = await tx.stockMovement.create({
        data: {
          branchId,
          ingredientId: ingredient.id,
          type: "SALE_DEDUCTION",
          quantity: Math.round(entry.totalDeduction * 10000) / 10000,
          unit: ingredient.unit,
          stockBefore,
          stockAfter,
          orderId: order.id,
          invoiceId,
          userId: cashierId,
          reason: `Sale deduction for Order #${order.orderNumber}`,
        },
      });

      movements.push(movement);
    }

    return {
      deducted: movements.length,
      movements,
    };
  }
}

export const inventoryService = new InventoryService();
