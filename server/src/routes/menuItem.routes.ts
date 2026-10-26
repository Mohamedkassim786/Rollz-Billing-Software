import { Router, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { authenticate, requireRoles, AuthenticatedRequest } from "../middleware/auth.middleware";
import { imageUpload, deleteLocalImage } from "../utils/fileUpload";

export const menuItemRouter = Router();
const db: any = prisma;

const createMenuItemSchema = z.object({
  categoryId: z.string().uuid("Invalid category ID"),
  name: z.string().trim().min(1, "Item name is required").max(100),
  description: z.string().trim().max(500).optional(),
  itemCode: z.string().trim().max(30).optional(),
  basePrice: z.coerce.number().int("Base price must be an integer in paise").min(0, "Base price cannot be negative"),
  taxCategory: z.string().trim().max(30).default("STANDARD"),
  isAvailable: z.boolean().default(true),
  isActive: z.boolean().default(true),
  displayOrder: z.coerce.number().int().min(0).default(0),
  modifierGroupIds: z.array(z.string().uuid()).optional(),
});

const updateMenuItemSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  itemCode: z.string().trim().max(30).nullable().optional(),
  basePrice: z.coerce.number().int("Base price must be an integer in paise").min(0, "Base price cannot be negative").optional(),
  taxCategory: z.string().trim().max(30).optional(),
  isAvailable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

const assignModifierGroupsSchema = z.object({
  modifierGroupIds: z.array(z.string().uuid()),
});

// 1. GET /api/menu-items - List items with category and modifiers
menuItemRouter.get("/", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const includeInactive = req.query.includeInactive === "true";
  const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
  const isAvailableParam = req.query.isAvailable;

  const where: any = { branchId };

  if (!includeInactive) {
    where.isActive = true;
  }
  if (categoryId) {
    where.categoryId = categoryId;
  }
  if (isAvailableParam !== undefined) {
    where.isAvailable = isAvailableParam === "true";
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { itemCode: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const items = await db.menuItem.findMany({
    where,
    orderBy: [{ category: { displayOrder: "asc" } }, { itemCode: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
    include: {
      category: {
        select: { id: true, name: true, slug: true, isActive: true },
      },
      modifierGroups: {
        where: { isEnabled: true },
        orderBy: { displayOrder: "asc" },
        include: {
          modifierGroup: {
            include: {
              options: {
                where: { isActive: true },
                orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
              },
            },
          },
        },
      },
    },
  });

  const formatted = items.map((item: any) => ({
    ...item,
    modifierGroupCount: item.modifierGroups.length,
  }));

  res.json({ menuItems: formatted });
});

// 2. GET /api/menu-items/:id - Get single item with complete preview configuration
menuItemRouter.get("/:id", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const branchId = req.user!.branchId;

  const item = await db.menuItem.findFirst({
    where: { id, branchId },
    include: {
      category: true,
      modifierGroups: {
        orderBy: { displayOrder: "asc" },
        include: {
          modifierGroup: {
            include: {
              options: {
                orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
              },
            },
          },
        },
      },
    },
  });

  if (!item) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Menu item not found" } });
    return;
  }

  res.json({ menuItem: item });
});

// 3. POST /api/menu-items - Create new menu item
menuItemRouter.post(
  "/",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const parseResult = createMenuItemSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid menu item data",
          details: parseResult.error.format(),
        },
      });
      return;
    }

    const branchId = req.user!.branchId;
    const {
      categoryId,
      name,
      description,
      itemCode,
      basePrice,
      taxCategory,
      isAvailable,
      isActive,
      displayOrder,
      modifierGroupIds,
    } = parseResult.data;

    // Verify category exists and belongs to branch
    const category = await db.category.findFirst({
      where: { id: categoryId, branchId },
    });

    if (!category) {
      res.status(400).json({
        error: {
          code: "INVALID_CATEGORY",
          message: "The specified category does not exist in this restaurant branch",
        },
      });
      return;
    }

    // If modifierGroupIds provided, verify each belongs to branch and is active
    if (modifierGroupIds && modifierGroupIds.length > 0) {
      const validGroups = await db.modifierGroup.findMany({
        where: { id: { in: modifierGroupIds }, branchId, isActive: true },
      });
      if (validGroups.length !== modifierGroupIds.length) {
        res.status(400).json({
          error: {
            code: "INVALID_MODIFIER_GROUP",
            message: "One or more modifier groups are invalid or inactive",
          },
        });
        return;
      }
    }

    // Create item and modifier associations in transaction
    const item = await db.$transaction(async (tx: any) => {
      const createdItem = await tx.menuItem.create({
        data: {
          branchId,
          categoryId,
          name,
          description: description || null,
          itemCode: itemCode || null,
          basePrice,
          taxCategory,
          isAvailable,
          isActive,
          displayOrder,
        },
      });

      if (modifierGroupIds && modifierGroupIds.length > 0) {
        await tx.menuItemModifierGroup.createMany({
          data: modifierGroupIds.map((groupId, index) => ({
            menuItemId: createdItem.id,
            modifierGroupId: groupId,
            displayOrder: index,
            isEnabled: true,
          })),
        });
      }

      return tx.menuItem.findUnique({
        where: { id: createdItem.id },
        include: {
          category: true,
          modifierGroups: {
            include: { modifierGroup: { include: { options: true } } },
          },
        },
      });
    });

    res.status(201).json({
      message: "Menu item created successfully",
      menuItem: item,
    });
  }
);

// 4. PATCH /api/menu-items/:id - Update menu item
menuItemRouter.patch(
  "/:id",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const existing = await db.menuItem.findFirst({
      where: { id, branchId },
    });

    if (!existing) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Menu item not found" } });
      return;
    }

    const parseResult = updateMenuItemSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid menu item update",
          details: parseResult.error.format(),
        },
      });
      return;
    }

    if (parseResult.data.categoryId) {
      const category = await db.category.findFirst({
        where: { id: parseResult.data.categoryId, branchId },
      });
      if (!category) {
        res.status(400).json({
          error: { code: "INVALID_CATEGORY", message: "The specified category is invalid" },
        });
        return;
      }
    }

    const updated = await db.menuItem.update({
      where: { id },
      data: parseResult.data,
      include: {
        category: true,
        modifierGroups: {
          include: { modifierGroup: { include: { options: true } } },
        },
      },
    });

    res.json({
      message: "Menu item updated successfully",
      menuItem: updated,
    });
  }
);

// 5. PATCH /api/menu-items/:id/availability - Toggle availability
menuItemRouter.patch(
  "/:id/availability",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const branchId = req.user!.branchId;
    const { isAvailable } = req.body;

    if (typeof isAvailable !== "boolean") {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "isAvailable must be a boolean" } });
      return;
    }

    const existing = await db.menuItem.findFirst({ where: { id, branchId } });
    if (!existing) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Menu item not found" } });
      return;
    }

    const updated = await db.menuItem.update({
      where: { id },
      data: { isAvailable },
    });

    res.json({
      message: `Item availability set to ${updated.isAvailable ? "available" : "unavailable"}`,
      menuItem: updated,
    });
  }
);

// 6. PATCH /api/menu-items/:id/status - Toggle active/maintained status
menuItemRouter.patch(
  "/:id/status",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const branchId = req.user!.branchId;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "isActive must be a boolean" } });
      return;
    }

    const existing = await db.menuItem.findFirst({ where: { id, branchId } });
    if (!existing) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Menu item not found" } });
      return;
    }

    const updated = await db.menuItem.update({
      where: { id },
      data: { isActive },
    });

    res.json({
      message: `Item ${updated.isActive ? "activated" : "deactivated"} successfully`,
      menuItem: updated,
    });
  }
);

// 7. GET /api/menu-items/:id/modifier-groups - Get assigned modifier groups
menuItemRouter.get("/:id/modifier-groups", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const branchId = req.user!.branchId;

  const item = await db.menuItem.findFirst({
    where: { id, branchId },
    include: {
      modifierGroups: {
        orderBy: { displayOrder: "asc" },
        include: {
          modifierGroup: {
            include: {
              options: {
                where: { isActive: true },
                orderBy: { displayOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!item) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Menu item not found" } });
    return;
  }

  res.json({
    modifierGroups: item.modifierGroups.map((g: any) => g.modifierGroup),
  });
});

// 8. PUT /api/menu-items/:id/modifier-groups - Assign modifier groups to item
menuItemRouter.put(
  "/:id/modifier-groups",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const parseResult = assignModifierGroupsSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid modifier groups assignment",
          details: parseResult.error.format(),
        },
      });
      return;
    }

    const { modifierGroupIds } = parseResult.data;

    const item = await db.menuItem.findFirst({
      where: { id, branchId },
    });

    if (!item) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Menu item not found" } });
      return;
    }

    // Verify all modifier groups belong to same branch
    if (modifierGroupIds.length > 0) {
      const validGroups = await db.modifierGroup.findMany({
        where: { id: { in: modifierGroupIds }, branchId, isActive: true },
      });
      if (validGroups.length !== modifierGroupIds.length) {
        res.status(400).json({
          error: {
            code: "INVALID_MODIFIER_GROUP",
            message: "One or more modifier groups are invalid or inactive",
          },
        });
        return;
      }
    }

    // Transactionally replace associations
    await db.$transaction(async (tx: any) => {
      await tx.menuItemModifierGroup.deleteMany({
        where: { menuItemId: id },
      });

      if (modifierGroupIds.length > 0) {
        await tx.menuItemModifierGroup.createMany({
          data: modifierGroupIds.map((groupId, index) => ({
            menuItemId: id,
            modifierGroupId: groupId,
            displayOrder: index,
            isEnabled: true,
          })),
        });
      }
    });

    const updated = await db.menuItem.findUnique({
      where: { id },
      include: {
        category: true,
        modifierGroups: {
          include: {
            modifierGroup: {
              include: { options: true },
            },
          },
        },
      },
    });

    res.json({
      message: "Modifier groups assigned successfully",
      menuItem: updated,
    });
  }
);

// 9. POST /api/menu-items/:id/image - Upload food image
menuItemRouter.post(
  "/:id/image",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  (req, res, next) => {
    imageUpload.single("image")(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({
          error: {
            code: "IMAGE_UPLOAD_ERROR",
            message: err.message || "Failed to process image upload",
          },
        });
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    if (!req.file) {
      res.status(400).json({
        error: { code: "MISSING_FILE", message: "No image file provided" },
      });
      return;
    }

    const item = await db.menuItem.findFirst({
      where: { id, branchId },
    });

    if (!item) {
      deleteLocalImage(req.file.filename);
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Menu item not found" } });
      return;
    }

    // Delete old image if it existed
    if (item.imagePath) {
      deleteLocalImage(item.imagePath);
    }

    const relativeUrl = `/uploads/menu-items/${req.file.filename}`;

    const updated = await db.menuItem.update({
      where: { id },
      data: { imagePath: relativeUrl },
    });

    res.json({
      message: "Image uploaded successfully",
      imagePath: updated.imagePath,
      menuItem: updated,
    });
  }
);

// 10. DELETE /api/menu-items/:id/image - Delete food image
menuItemRouter.delete(
  "/:id/image",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const item = await db.menuItem.findFirst({
      where: { id, branchId },
    });

    if (!item) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Menu item not found" } });
      return;
    }

    if (item.imagePath) {
      deleteLocalImage(item.imagePath);
    }

    const updated = await db.menuItem.update({
      where: { id },
      data: { imagePath: null },
    });

    res.json({
      message: "Image removed successfully",
      menuItem: updated,
    });
  }
);

// 11. DELETE /api/menu-items/:id - Delete item
menuItemRouter.delete(
  "/:id",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const item = await db.menuItem.findFirst({
      where: { id, branchId },
    });

    if (!item) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Menu item not found" } });
      return;
    }

    if (item.imagePath) {
      deleteLocalImage(item.imagePath);
    }

    await db.menuItem.delete({ where: { id } });

    res.json({ message: "Menu item deleted successfully" });
  }
);
