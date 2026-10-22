import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { hashPassword, verifyPassword, generateToken } from "../utils/auth";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.middleware";
import { loginRateLimiter } from "../middleware/rateLimiter";
import { ensureDefaultBranchAndCategories } from "../utils/seedInitialData";

export const authRouter = Router();

const setupOwnerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(30),
  password: z.string().min(6, "Password must be at least 6 characters"),
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
});

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Check if initial setup is complete & return public branch branding
authRouter.get("/status", async (_req: Request, res: Response) => {
  const ownerCount = await prisma.user.count({
    where: { role: "OWNER" },
  });

  const branch = await prisma.branch.findFirst({
    select: {
      id: true,
      name: true,
      code: true,
      tagline: true,
      logoPath: true,
      loginBgPath: true,
      taxMode: true,
    },
  });

  res.json({
    isOwnerSetup: ownerCount > 0,
    branch: branch || null,
  });
});

// First-run owner setup (disabled after initial owner is created)
authRouter.post("/setup-owner", async (req: Request, res: Response) => {
  const parseResult = setupOwnerSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid registration data",
        details: parseResult.error.format(),
      },
    });
    return;
  }

  const existingOwner = await prisma.user.findFirst({
    where: { role: "OWNER" },
  });

  if (existingOwner) {
    res.status(403).json({
      error: {
        code: "OWNER_ALREADY_EXISTS",
        message: "Initial owner setup is already completed. Please log in.",
      },
    });
    return;
  }

  const branch = await ensureDefaultBranchAndCategories(prisma);

  const { username, password, displayName } = parseResult.data;
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      branchId: branch.id,
      username: username.toLowerCase().trim(),
      displayName: displayName.trim(),
      passwordHash,
      role: "OWNER",
      isActive: true,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      branchId: true,
      createdAt: true,
    },
  });

  const token = generateToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    branchId: user.branchId,
    displayName: user.displayName,
  });

  res.status(201).json({
    message: "Owner account initialized successfully",
    user,
    branch: {
      id: branch.id,
      name: branch.name,
      code: branch.code,
    },
    token,
  });
});

// Secure user login with rate limiter
authRouter.post("/login", loginRateLimiter, async (req: Request, res: Response) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid credentials format",
      },
    });
    return;
  }

  const { username, password } = parseResult.data;
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase().trim() },
    include: { branch: true },
  });

  if (!user || !user.isActive) {
    res.status(401).json({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid username or password",
      },
    });
    return;
  }

  if (!user.branch.isActive) {
    res.status(403).json({
      error: {
        code: "BRANCH_INACTIVE",
        message: "The assigned restaurant branch is inactive",
      },
    });
    return;
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    res.status(401).json({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid username or password",
      },
    });
    return;
  }

  const token = generateToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    branchId: user.branchId,
    displayName: user.displayName,
  });

  res.json({
    message: "Login successful",
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      branchId: user.branchId,
    },
    branch: {
      id: user.branch.id,
      name: user.branch.name,
      code: user.branch.code,
      taxMode: user.branch.taxMode || "GST",
      gstin: user.branch.gstin || null,
      upiId: user.branch.upiId || null,
      upiPayeeName: user.branch.upiPayeeName || null,
      tagline: (user.branch as any).tagline || "Fresh • Crispy • Handcrafted",
      logoPath: (user.branch as any).logoPath || null,
      loginBgPath: (user.branch as any).loginBgPath || null,
    },
    token,
  });
});

// Get current profile
authRouter.get("/me", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    include: { branch: true },
  });

  if (!user || !user.isActive) {
    res.status(401).json({ error: { code: "USER_NOT_FOUND", message: "User account is unavailable" } });
    return;
  }

  res.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      branchId: user.branchId,
    },
    branch: {
      id: user.branch.id,
      name: user.branch.name,
      code: user.branch.code,
      taxMode: user.branch.taxMode || "GST",
      gstin: user.branch.gstin || null,
      upiId: user.branch.upiId || null,
      upiPayeeName: user.branch.upiPayeeName || null,
      tagline: (user.branch as any).tagline || "Fresh • Crispy • Handcrafted",
      logoPath: (user.branch as any).logoPath || null,
      loginBgPath: (user.branch as any).loginBgPath || null,
    },
  });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

// Change Password for current logged-in user
authRouter.post("/change-password", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const parse = changePasswordSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: parse.error.issues[0]?.message || "Invalid password parameters",
      },
    });
    return;
  }

  const { currentPassword, newPassword } = parse.data;
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
  });

  if (!user) {
    res.status(404).json({ error: { message: "User account not found" } });
    return;
  }

  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) {
    res.status(400).json({ error: { message: "Current password is incorrect. Please try again." } });
    return;
  }

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  res.json({ success: true, message: "Password updated successfully" });
});

// Update Profile (Display Name)
const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2, "Display name must be at least 2 characters").max(50),
});

authRouter.patch("/profile", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const parse = updateProfileSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: parse.error.issues[0]?.message || "Invalid profile data",
      },
    });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { displayName: parse.data.displayName },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      branchId: true,
    },
  });

  res.json({ success: true, user: updated, message: "Profile updated successfully" });
});
