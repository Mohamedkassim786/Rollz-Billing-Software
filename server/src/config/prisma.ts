import { PrismaClient } from "@prisma/client";

// Global singleton for PrismaClient to prevent multiple instances in development
const globalForPrisma = globalThis as unknown as { prisma: any };

export const prisma: PrismaClient & Record<string, any> = (
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })
) as any;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export interface DbHealthResult {
  connected: boolean;
  latencyMs: number;
  version?: string;
  error?: string;
}

export async function checkDatabaseConnection(): Promise<DbHealthResult> {
  const start = performance.now();
  try {
    const result = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version();`;
    const latencyMs = Math.round(performance.now() - start);
    return {
      connected: true,
      latencyMs,
      version: result[0]?.version,
    };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - start);
    const errorMessage = err instanceof Error ? err.message : "Unknown database error";
    return {
      connected: false,
      latencyMs,
      error: errorMessage,
    };
  }
}
