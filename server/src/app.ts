import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import { healthRouter } from "./routes/health.routes";
import { authRouter } from "./routes/auth.routes";
import { categoryRouter } from "./routes/category.routes";
import { modifierRouter } from "./routes/modifier.routes";
import { menuItemRouter } from "./routes/menuItem.routes";
import { posRouter } from "./routes/pos.routes";
import { orderRouter } from "./routes/order.routes";
import { paymentRouter } from "./routes/payment.routes";
import { invoiceRouter } from "./routes/invoice.routes";
import { printJobRouter } from "./routes/printJob.routes";
import { inventoryRouter } from "./routes/inventory.routes";
import { shiftRouter } from "./routes/shift.routes";
import { reportRouter } from "./routes/report.routes";
import { settingsRouter } from "./routes/settings.routes";
import { env } from "./config/env";
import { UPLOAD_ROOT } from "./utils/fileUpload";

export const app = express();

// Disable x-powered-by header
app.disable("x-powered-by");

// Standard security headers middleware
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Security and CORS configuration (supports localhost and restaurant LAN private IPs)
const LAN_ORIGIN_REGEX = /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., server-to-server, curl, same-origin)
      if (!origin) return callback(null, true);

      const staticAllowed = [
        env.CORS_ORIGIN,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
      ];

      if (staticAllowed.includes(origin) || LAN_ORIGIN_REGEX.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS origin policy blocked request from ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());

// Serve local uploaded images statically
app.use("/uploads/menu-items", express.static(UPLOAD_ROOT));

// API Routes
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/modifier-groups", modifierRouter);
app.use("/api/menu-items", menuItemRouter);
app.use("/api/pos", posRouter);
app.use("/api/orders/:id/payments", paymentRouter);
app.use("/api/orders", orderRouter);
app.use("/api/invoices", invoiceRouter);
app.use("/api/print-jobs", printJobRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/shifts", shiftRouter);
app.use("/api/reports", reportRouter);
app.use("/api/settings", settingsRouter);

// Root informational endpoint
app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "ROLLZ POS API",
    status: "running",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      categories: "/api/categories",
      menuItems: "/api/menu-items",
      modifierGroups: "/api/modifier-groups",
      pos: "/api/pos",
      orders: "/api/orders",
      payments: "/api/orders/:id/payments",
      invoices: "/api/invoices",
      printJobs: "/api/print-jobs",
      inventory: "/api/inventory",
      shifts: "/api/shifts",
      reports: "/api/reports",
      settings: "/api/settings",
    },
  });
});

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "The requested endpoint does not exist",
    },
  });
});

// Global Error Handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] Unhandled error:`, err);
  const isProd = env.NODE_ENV === "production";
  const message = err instanceof Error ? err.message : "Internal Server Error";
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: isProd ? "Internal Server Error" : message,
    },
  });
});
