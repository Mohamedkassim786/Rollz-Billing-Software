import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { authenticate, requireRoles, AuthenticatedRequest } from "../middleware/auth.middleware";

export const categoryRouter = Router();

// Zod validation schemas
const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(60, "Category name too long"),
  description: z.string().trim().max(300).optional(),
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const updateCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(60).optional(),
  description: z.string().trim().max(300).nullable().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const reorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid("Invalid category ID format"),
      displayOrder: z.coerce.number().int().min(0),
    })
  ).min(1, "At least one category order must be specified"),
});

const statusSchema = z.object({
  isActive: z.boolean(),
});

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// 1. GET /api/categories - List categories for branch
categoryRouter.get("/", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const includeInactive = req.query.includeInactive === "true";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;

  const where: any = { branchId };
  if (!includeInactive) {
    where.isActive = true;
  }
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  const categories = await prisma.category.findMany({
    where,
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          menuItems: {
            where: { isActive: true },
          },
        },
      },
    },
  });

  const formatted = categories.map((c) => ({
    ...c,
    itemCount: c._count.menuItems,
  }));

  res.json({ categories: formatted });
});

// 2. PATCH /api/categories/reorder - Batch reorder categories
categoryRouter.patch(
  "/reorder",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const parseResult = reorderSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid reorder payload",
          details: parseResult.error.format(),
        },
      });
      return;
    }

    const { items } = parseResult.data;
    const branchId = req.user!.branchId;

    // Run updates in a single transaction
    await prisma.$transaction(
      items.map((item) =>
        prisma.category.updateMany({
          where: { id: item.id, branchId },
          data: { displayOrder: item.displayOrder },
        })
      )
    );

    res.json({ message: "Categories reordered successfully" });
  }
);

// 3. GET /api/categories/:id - Get single category
categoryRouter.get("/:id", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const branchId = req.user!.branchId;

  const category = await prisma.category.findFirst({
    where: { id, branchId },
    include: {
      _count: {
        select: { menuItems: true },
      },
    },
  });

  if (!category) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Category not found" },
    });
    return;
  }

  res.json({
    category: {
      ...category,
      itemCount: category._count.menuItems,
    },
  });
});

// 4. POST /api/categories - Create new category
categoryRouter.post(
  "/",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const parseResult = createCategorySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid category data",
          details: parseResult.error.format(),
        },
      });
      return;
    }

    const { name, description, displayOrder, isActive } = parseResult.data;
    const branchId = req.user!.branchId;

    // Check for duplicate name in branch
    const existing = await prisma.category.findUnique({
      where: {
        branchId_name: { branchId, name },
      },
    });

    if (existing) {
      res.status(409).json({
        error: {
          code: "DUPLICATE_CATEGORY",
          message: `Category '${name}' already exists in this restaurant branch`,
        },
      });
      return;
    }

    const category = await prisma.category.create({
      data: {
        branchId,
        name,
        slug: generateSlug(name),
        description: description || null,
        displayOrder,
        isActive,
      },
    });

    res.status(201).json({
      message: "Category created successfully",
      category: { ...category, itemCount: 0 },
    });
  }
);

// 5. PATCH /api/categories/:id - Update category
categoryRouter.patch(
  "/:id",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const parseResult = updateCategorySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid category update data",
          details: parseResult.error.format(),
        },
      });
      return;
    }

    const existing = await prisma.category.findFirst({
      where: { id, branchId },
    });

    if (!existing) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Category not found" },
      });
      return;
    }

    const updateData: any = {};
    if (parseResult.data.name !== undefined) {
      const newName = parseResult.data.name;
      if (newName !== existing.name) {
        const nameConflict = await prisma.category.findUnique({
          where: { branchId_name: { branchId, name: newName } },
        });
        if (nameConflict) {
          res.status(409).json({
            error: {
              code: "DUPLICATE_CATEGORY",
              message: `Category name '${newName}' is already taken`,
            },
          });
          return;
        }
        updateData.name = newName;
        updateData.slug = generateSlug(newName);
      }
    }

    if (parseResult.data.description !== undefined) {
      updateData.description = parseResult.data.description;
    }
    if (parseResult.data.displayOrder !== undefined) {
      updateData.displayOrder = parseResult.data.displayOrder;
    }
    if (parseResult.data.isActive !== undefined) {
      updateData.isActive = parseResult.data.isActive;
    }

    const updated = await prisma.category.update({
      where: { id },
      data: updateData,
    });

    res.json({
      message: "Category updated successfully",
      category: updated,
    });
  }
);

// 6. PATCH /api/categories/:id/status - Toggle active status
categoryRouter.patch(
  "/:id/status",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const parseResult = statusSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "isActive must be a boolean" },
      });
      return;
    }

    const category = await prisma.category.findFirst({
      where: { id, branchId },
    });

    if (!category) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Category not found" } });
      return;
    }

    const updated = await prisma.category.update({
      where: { id },
      data: { isActive: parseResult.data.isActive },
    });

    res.json({
      message: `Category ${updated.isActive ? "activated" : "deactivated"} successfully`,
      category: updated,
    });
  }
);

// 7. DELETE /api/categories/:id - Delete if unused; else recommend deactivation
categoryRouter.delete(
  "/:id",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const category = await prisma.category.findFirst({
      where: { id, branchId },
      include: {
        _count: { select: { menuItems: true } },
      },
    });

    if (!category) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Category not found" } });
      return;
    }

    if (category._count.menuItems > 0) {
      res.status(409).json({
        error: {
          code: "CATEGORY_IN_USE",
          message: `Cannot delete category '${category.name}' because it contains ${category._count.menuItems} menu item(s). Deactivate the category instead to preserve historical records.`,
        },
      });
      return;
    }

    await prisma.category.delete({ where: { id } });

    res.json({ message: "Category deleted successfully" });
  }
);
