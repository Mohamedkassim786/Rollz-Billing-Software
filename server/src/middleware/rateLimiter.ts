import { Request, Response, NextFunction } from "express";

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const loginAttempts = new Map<string, RateLimitRecord>();

/**
 * Basic in-memory sliding window rate limiter to protect sensitive authentication endpoints
 */
export function authRateLimiter(maxAttempts = 15, windowMs = 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    // In test environment, skip rate limiting to avoid test interference
    if (process.env.NODE_ENV === "test") {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const now = Date.now();

    const record = loginAttempts.get(ip);

    if (!record || now > record.resetTime) {
      loginAttempts.set(ip, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    if (record.count >= maxAttempts) {
      const waitSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.status(429).json({
        error: {
          code: "TOO_MANY_REQUESTS",
          message: `Too many login attempts. Please wait ${waitSeconds} seconds before trying again.`,
        },
      });
      return;
    }

    record.count++;
    next();
  };
}

export const loginRateLimiter = authRateLimiter(15, 60 * 1000);
