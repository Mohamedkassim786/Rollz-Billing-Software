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

// Check if initial setup is complete
authRouter.get("/status", async (_req: Request, res: Response) => {
  const ownerCount = await prisma.user.count({
    where: { role: "OWNER" },
  });

  res.json({
    isOwnerSetup: ownerCount > 0,
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
    },
  });
});
