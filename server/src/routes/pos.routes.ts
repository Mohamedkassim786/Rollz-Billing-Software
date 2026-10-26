import { Router, Response } from "express";
import { prisma } from "../config/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.middleware";

export const posRouter = Router();
const db: any = prisma;

/**
 * 1. GET /api/pos/categories
 * Returns active categories for the cashier's branch with available item counts
 */
posRouter.get("/categories", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;

  try {
    const categories = await db.category.findMany({
      where: {
        branchId,
        isActive: true,
      },
      orderBy: {
        displayOrder: "asc",
      },
      include: {
        _count: {
          select: {
            menuItems: {
              where: {
                isActive: true,
                isAvailable: true,
              },
            },
          },
        },
      },
    });

    const formatted = categories.map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imagePath: c.imagePath,
      displayOrder: c.displayOrder,
      isActive: c.isActive,
      availableItemCount: c._count?.menuItems || 0,
    }));

    res.json({ categories: formatted });
  } catch (err: any) {
    console.error("Failed to fetch POS categories:", err);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to load POS food categories",
      },
    });
  }
});

/**
 * 2. GET /api/pos/menu-items
 * Returns active, available items for the cashier's branch with assigned modifier groups & options
 */
posRouter.get("/menu-items", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;

  const where: any = {
    branchId,
    isActive: true,
    isAvailable: true,
  };

  if (categoryId && categoryId !== "ALL") {
    where.categoryId = categoryId;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { itemCode: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  try {
    const items = await db.menuItem.findMany({
      where,
      orderBy: [{ itemCode: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        modifierGroups: {
          where: {
            isEnabled: true,
            modifierGroup: {
              isActive: true,
            },
          },
          orderBy: {
            displayOrder: "asc",
          },
          include: {
            modifierGroup: {
              include: {
                options: {
                  where: {
                    isActive: true,
                  },
                  orderBy: {
                    displayOrder: "asc",
                  },
                },
              },
            },
          },
        },
      },
    });

    const formatted = items.map((item: any) => ({
      id: item.id,
      categoryId: item.categoryId,
      category: item.category,
      name: item.name,
      description: item.description,
      itemCode: item.itemCode,
      imagePath: item.imagePath,
      basePrice: item.basePrice,
      taxCategory: item.taxCategory,
      isAvailable: item.isAvailable,
      modifierGroups: item.modifierGroups.map((rel: any) => ({
        id: rel.modifierGroup.id,
        name: rel.modifierGroup.name,
        description: rel.modifierGroup.description,
        selectionType: rel.modifierGroup.selectionType,
        isRequired: rel.modifierGroup.isRequired,
        minSelections: rel.modifierGroup.minSelections,
        maxSelections: rel.modifierGroup.maxSelections,
        options: rel.modifierGroup.options.map((opt: any) => ({
          id: opt.id,
          name: opt.name,
          description: opt.description,
          extraPrice: opt.extraPrice,
          isAvailable: opt.isAvailable,
        })),
      })),
    }));

    res.json({ menuItems: formatted });
  } catch (err: any) {
    console.error("Failed to fetch POS menu items:", err);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to load POS menu items",
      },
    });
  }
});

/**
 * 3. GET /api/pos/menu-items/:id
 * Retrieve single item details for POS customization
 */
posRouter.get("/menu-items/:id", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const { id } = req.params;

  try {
    const item = await db.menuItem.findFirst({
      where: {
        id,
        branchId,
        isActive: true,
      },
      include: {
        category: true,
        modifierGroups: {
          where: {
            isEnabled: true,
            modifierGroup: {
              isActive: true,
            },
          },
          include: {
            modifierGroup: {
              include: {
                options: {
                  where: {
                    isActive: true,
                  },
                  orderBy: {
                    displayOrder: "asc",
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!item) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Menu item not found or unavailable in this branch",
        },
      });
      return;
    }

    res.json({ menuItem: item });
  } catch (err: any) {
    console.error("Failed to fetch menu item details:", err);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve menu item details",
      },
    });
  }
});
