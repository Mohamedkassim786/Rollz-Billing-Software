import { PrismaClient } from "@prisma/client";
import { hashPassword, generateToken } from "../src/utils/auth";
import { ensureDefaultBranchAndCategories } from "../src/utils/seedInitialData";

export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://rollz_app:rollz_secure_pass_2026@localhost:5432/rollz_pos_test?schema=public",
    },
  },
});

export interface TestAuthContext {
  branch: { id: string; name: string; code: string };
  owner: { id: string; username: string };
  ownerToken: string;
  cashier: { id: string; username: string };
  cashierToken: string;
  otherBranch: { id: string; name: string; code: string };
  otherBranchOwnerToken: string;
}

export async function setupTestEnvironment(): Promise<TestAuthContext> {
  // Ensure default branch & initial categories in test database
  const branch = await ensureDefaultBranchAndCategories(testPrisma);

  const passwordHash = await hashPassword("TestPassword123!");

  // Create or retrieve test owner using upsert
  const owner = await testPrisma.user.upsert({
    where: { username: "test_owner" },
    update: { branchId: branch.id, role: "OWNER", isActive: true },
    create: {
      branchId: branch.id,
      username: "test_owner",
      displayName: "Test Owner",
      passwordHash,
      role: "OWNER",
      isActive: true,
    },
  });

  const ownerToken = generateToken({
    userId: owner.id,
    username: owner.username,
    role: owner.role,
    branchId: owner.branchId,
    displayName: owner.displayName,
  });

  // Create or retrieve test cashier using upsert
  const cashier = await testPrisma.user.upsert({
    where: { username: "test_cashier" },
    update: { branchId: branch.id, role: "CASHIER", isActive: true },
    create: {
      branchId: branch.id,
      username: "test_cashier",
      displayName: "Test Cashier",
      passwordHash,
      role: "CASHIER",
      isActive: true,
    },
  });

  const cashierToken = generateToken({
    userId: cashier.id,
    username: cashier.username,
    role: cashier.role,
    branchId: cashier.branchId,
    displayName: cashier.displayName,
  });

  // Create second branch for cross-branch isolation testing
  const otherBranch = await testPrisma.branch.upsert({
    where: { code: "ROLLZ-BRANCH-TEST-002" },
    update: { isActive: true },
    create: {
      name: "Branch 2 (Test)",
      code: "ROLLZ-BRANCH-TEST-002",
      isActive: true,
    },
  });

  const otherOwner = await testPrisma.user.upsert({
    where: { username: "other_branch_owner" },
    update: { branchId: otherBranch.id, role: "OWNER", isActive: true },
    create: {
      branchId: otherBranch.id,
      username: "other_branch_owner",
      displayName: "Other Branch Owner",
      passwordHash,
      role: "OWNER",
      isActive: true,
    },
  });

  const otherBranchOwnerToken = generateToken({
    userId: otherOwner.id,
    username: otherOwner.username,
    role: otherOwner.role,
    branchId: otherOwner.branchId,
    displayName: otherOwner.displayName,
  });

  return {
    branch,
    owner,
    ownerToken,
    cashier,
    cashierToken,
    otherBranch,
    otherBranchOwnerToken,
  };
}
