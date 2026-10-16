import { Router, Request, Response } from "express";
import { checkDatabaseConnection } from "../config/prisma";
import { env } from "../config/env";

export const healthRouter = Router();

healthRouter.get("/", async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseConnection();

  const isHealthy = dbHealth.connected;
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: isHealthy ? "healthy" : "unhealthy",
    service: "ROLLZ POS Server",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: env.NODE_ENV,
    database: {
      connected: dbHealth.connected,
      latencyMs: dbHealth.latencyMs,
      version: dbHealth.version ? dbHealth.version.split(" ")[0] + " " + dbHealth.version.split(" ")[1] : undefined,
      ...(dbHealth.error ? { error: dbHealth.error } : {}),
    },
  });
});
