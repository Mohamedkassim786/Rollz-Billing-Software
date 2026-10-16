import { Router, Response } from "express";
import { z } from "zod";
import { SelectionType } from "@prisma/client";
import { prisma } from "../config/prisma";
import { authenticate, requireRoles, AuthenticatedRequest } from "../middleware/auth.middleware";

export const modifierRouter = Router();

const createModifierGroupSchema = z
  .object({
    name: z.string().trim().min(1, "Modifier group name is required").max(60),
    description: z.string().trim().max(300).optional(),
    selectionType: z.nativeEnum(SelectionType).default(SelectionType.SINGLE),
    isRequired: z.boolean().default(false),
    minSelections: z.coerce.number().int().min(0).default(0),
    maxSelections: z.coerce.number().int().min(1).default(1),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.selectionType === SelectionType.SINGLE) {
        return data.maxSelections === 1;
      }
      return true;
    },
    { message: "Single-choice modifier groups must have maxSelections equal to 1", path: ["maxSelections"] }
  )
  .refine((data) => data.minSelections <= data.maxSelections, {
    message: "minSelections cannot exceed maxSelections",
    path: ["minSelections"],
  })
  .refine(
    (data) => {
      if (data.isRequired) {
        return data.minSelections >= 1;
      }
      return true;
    },
    { message: "Required groups must have minSelections of at least 1", path: ["minSelections"] }
  );

const updateModifierGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    description: z.string().trim().max(300).nullable().optional(),
    selectionType: z.nativeEnum(SelectionType).optional(),
    isRequired: z.boolean().optional(),
    minSelections: z.coerce.number().int().min(0).optional(),
    maxSelections: z.coerce.number().int().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.selectionType === SelectionType.SINGLE && data.maxSelections !== undefined) {
        return data.maxSelections === 1;
      }
      return true;
    },
    { message: "Single-choice groups must have maxSelections equal to 1", path: ["maxSelections"] }
  )
  .refine(
    (data) => {
      if (data.minSelections !== undefined && data.maxSelections !== undefined) {
        return data.minSelections <= data.maxSelections;
      }
      return true;
    },
    { message: "minSelections cannot exceed maxSelections", path: ["minSelections"] }
  );

const createOptionSchema = z.object({
  name: z.string().trim().min(1, "Option name is required").max(60),
  description: z.string().trim().max(300).optional(),
  extraPrice: z.coerce.number().int("Price must be an integer in paise").min(0, "Price cannot be negative").default(0),
  isAvailable: z.boolean().default(true),
  isActive: z.boolean().default(true),
  displayOrder: z.coerce.number().int().min(0).default(0),
});

const updateOptionSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(300).nullable().optional(),
  extraPrice: z.coerce.number().int("Price must be an integer in paise").min(0, "Price cannot be negative").optional(),
  isAvailable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

// 1. GET /api/modifier-groups - List all modifier groups for branch
modifierRouter.get("/", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const includeInactive = req.query.includeInactive === "true";

  const where: any = { branchId };
  if (!includeInactive) {
    where.isActive = true;
  }

  const groups = await prisma.modifierGroup.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      options: {
        where: includeInactive ? {} : { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      },
      _count: {
        select: {
          menuItems: true,
        },
      },
    },
  });

  const formatted = groups.map((g) => ({
    ...g,
    itemCount: g._count.menuItems,
  }));

  res.json({ modifierGroups: formatted });
});

// 2. GET /api/modifier-groups/:id - Get single group
modifierRouter.get("/:id", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const branchId = req.user!.branchId;

  const group = await prisma.modifierGroup.findFirst({
    where: { id, branchId },
    include: {
      options: {
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      },
      _count: {
        select: { menuItems: true },
      },
    },
  });

  if (!group) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Modifier group not found" } });
    return;
  }

  res.json({
    modifierGroup: {
      ...group,
      itemCount: group._count.menuItems,
    },
  });
});

// 3. POST /api/modifier-groups - Create modifier group
modifierRouter.post(
  "/",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const parseResult = createModifierGroupSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid modifier group configuration",
          details: parseResult.error.format(),
        },
      });
      return;
    }

    const branchId = req.user!.branchId;
    const { name, description, selectionType, isRequired, minSelections, maxSelections, isActive } =
      parseResult.data;

    const group = await prisma.modifierGroup.create({
      data: {
        branchId,
        name,
        description: description || null,
        selectionType,
        isRequired,
        minSelections,
        maxSelections,
        isActive,
      },
      include: {
        options: true,
      },
    });

    res.status(201).json({
      message: "Modifier group created successfully",
      modifierGroup: { ...group, itemCount: 0 },
    });
  }
);

// 4. PATCH /api/modifier-groups/:id - Update group
modifierRouter.patch(
  "/:id",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const existing = await prisma.modifierGroup.findFirst({
      where: { id, branchId },
    });

    if (!existing) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Modifier group not found" } });
      return;
    }

    const parseResult = updateModifierGroupSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid modifier group update",
          details: parseResult.error.format(),
        },
      });
      return;
    }

    const updated = await prisma.modifierGroup.update({
      where: { id },
      data: parseResult.data,
      include: {
        options: { orderBy: [{ displayOrder: "asc" }, { name: "asc" }] },
      },
    });

    res.json({
      message: "Modifier group updated successfully",
      modifierGroup: updated,
    });
  }
);

// 5. PATCH /api/modifier-groups/:id/status - Toggle group status
modifierRouter.patch(
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

    const existing = await prisma.modifierGroup.findFirst({
      where: { id, branchId },
    });

    if (!existing) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Modifier group not found" } });
      return;
    }

    const updated = await prisma.modifierGroup.update({
      where: { id },
      data: { isActive },
    });

    res.json({
      message: `Modifier group ${updated.isActive ? "activated" : "deactivated"} successfully`,
      modifierGroup: updated,
    });
  }
);

// 6. DELETE /api/modifier-groups/:id - Delete group
modifierRouter.delete(
  "/:id",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const existing = await prisma.modifierGroup.findFirst({
      where: { id, branchId },
      include: { _count: { select: { menuItems: true } } },
    });

    if (!existing) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Modifier group not found" } });
      return;
    }

    if (existing._count.menuItems > 0) {
      res.status(409).json({
        error: {
          code: "GROUP_IN_USE",
          message: `Cannot delete modifier group '${existing.name}' because it is assigned to ${existing._count.menuItems} item(s). Please unassign or deactivate it instead.`,
        },
      });
      return;
    }

    await prisma.modifierGroup.delete({ where: { id } });
    res.json({ message: "Modifier group deleted successfully" });
  }
);

// 7. POST /api/modifier-groups/:id/options - Create option inside group
modifierRouter.post(
  "/:id/options",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const group = await prisma.modifierGroup.findFirst({
      where: { id, branchId },
    });

    if (!group) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Modifier group not found" } });
      return;
    }

    const parseResult = createOptionSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid modifier option data",
          details: parseResult.error.format(),
        },
      });
      return;
    }

    const { name, description, extraPrice, isAvailable, isActive, displayOrder } = parseResult.data;

    const option = await prisma.modifierOption.create({
      data: {
        modifierGroupId: id,
        name,
        description: description || null,
        extraPrice,
        isAvailable,
        isActive,
        displayOrder,
      },
    });

    res.status(201).json({
      message: "Modifier option added successfully",
      option,
    });
  }
);

// 8. PATCH /api/modifier-options/:id - Update option
modifierRouter.patch(
  "/options/:id",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const option = await prisma.modifierOption.findUnique({
      where: { id },
      include: { modifierGroup: true },
    });

    if (!option || option.modifierGroup.branchId !== branchId) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Modifier option not found" } });
      return;
    }

    const parseResult = updateOptionSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid modifier option update",
          details: parseResult.error.format(),
        },
      });
      return;
    }

    const updated = await prisma.modifierOption.update({
      where: { id },
      data: parseResult.data,
    });

    res.json({
      message: "Modifier option updated successfully",
      option: updated,
    });
  }
);

// 9. PATCH /api/modifier-options/:id/status - Toggle option availability/activation
modifierRouter.patch(
  "/options/:id/status",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const option = await prisma.modifierOption.findUnique({
      where: { id },
      include: { modifierGroup: true },
    });

    if (!option || option.modifierGroup.branchId !== branchId) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Modifier option not found" } });
      return;
    }

    const { isActive, isAvailable } = req.body;
    const updateData: any = {};
    if (typeof isActive === "boolean") updateData.isActive = isActive;
    if (typeof isAvailable === "boolean") updateData.isAvailable = isAvailable;

    const updated = await prisma.modifierOption.update({
      where: { id },
      data: updateData,
    });

    res.json({
      message: "Option status updated successfully",
      option: updated,
    });
  }
);

// 10. DELETE /api/modifier-options/:id - Delete option
modifierRouter.delete(
  "/options/:id",
  authenticate,
  requireRoles(["OWNER", "MANAGER"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const option = await prisma.modifierOption.findUnique({
      where: { id },
      include: { modifierGroup: true },
    });

    if (!option || option.modifierGroup.branchId !== branchId) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Modifier option not found" } });
      return;
    }

    await prisma.modifierOption.delete({ where: { id } });
    res.json({ message: "Modifier option deleted successfully" });
  }
);
