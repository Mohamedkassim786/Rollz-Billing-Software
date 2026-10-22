import { Router, Response } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { authenticate, AuthenticatedRequest, requireRoles } from "../middleware/auth.middleware";
import { hashPassword } from "../utils/auth";

export const userRouter = Router();

userRouter.use(authenticate);

const createUserSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(30),
  displayName: z.string().trim().min(2, "Display name must be at least 2 characters").max(50),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["CASHIER", "MANAGER", "KITCHEN"]).default("CASHIER"),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

/**
 * GET /api/users
 * List all staff members for the current branch
 */
userRouter.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;

  const users = await prisma.user.findMany({
    where: { branchId },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [
      { role: "asc" },
      { createdAt: "desc" },
    ],
  });

  res.json({ success: true, users });
});

/**
 * POST /api/users
 * Create a new cashier or staff member
 */
userRouter.post(
  "/",
  requireRoles([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const parse = createUserSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: parse.error.issues[0]?.message || "Invalid user data",
        },
      });
      return;
    }

    const { username, displayName, password, role } = parse.data;
    const branchId = req.user!.branchId;

    // Check if username is already taken
    const existing = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });

    if (existing) {
      res.status(400).json({
        error: {
          code: "USERNAME_TAKEN",
          message: `Username '${username}' is already in use. Please choose another username.`,
        },
      });
      return;
    }

    const passwordHash = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        branchId,
        username: username.toLowerCase(),
        displayName,
        passwordHash,
        role: role as Role,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      user: newUser,
      message: `Staff account '${newUser.displayName}' created successfully!`,
    });
  }
);

/**
 * PATCH /api/users/:id/status
 * Activate or deactivate a staff member
 */
userRouter.patch(
  "/:id/status",
  requireRoles([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const targetUserId = req.params.id;
    const branchId = req.user!.branchId;

    if (targetUserId === req.user!.userId) {
      res.status(400).json({
        error: { message: "You cannot deactivate your own account while logged in." },
      });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { id: targetUserId, branchId },
    });

    if (!user) {
      res.status(404).json({ error: { message: "User not found" } });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
      },
    });

    res.json({
      success: true,
      user: updated,
      message: `Staff account is now ${updated.isActive ? "Active" : "Deactivated"}.`,
    });
  }
);

/**
 * POST /api/users/:id/reset-password
 * Owner/Manager resets cashier password
 */
userRouter.post(
  "/:id/reset-password",
  requireRoles([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const targetUserId = req.params.id;
    const branchId = req.user!.branchId;

    const parse = resetPasswordSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        error: { message: parse.error.issues[0]?.message || "Invalid password" },
      });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { id: targetUserId, branchId },
    });

    if (!user) {
      res.status(404).json({ error: { message: "User not found" } });
      return;
    }

    const newHash = await hashPassword(parse.data.newPassword);
    await prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash: newHash },
    });

    res.json({
      success: true,
      message: `Password for ${user.displayName} (@${user.username}) has been reset successfully.`,
    });
  }
);
