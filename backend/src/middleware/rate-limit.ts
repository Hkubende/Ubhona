import type { NextFunction, Request, Response } from "express";

type KeyGenerator = (req: Request) => string;

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  keyGenerator?: KeyGenerator;
  message?: string;
};

type WindowEntry = {
  count: number;
  resetAt: number;
};

const windows = new Map<string, WindowEntry>();

function getIp(req: Request) {
  const forwarded = req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.ip || "unknown";
}

function defaultKeyGenerator(req: Request) {
  return getIp(req);
}

function getWindowEntry(key: string, now: number, windowMs: number) {
  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    const fresh: WindowEntry = { count: 0, resetAt: now + windowMs };
    windows.set(key, fresh);
    return fresh;
  }
  return existing;
}

export function createRateLimiter(options: RateLimitOptions) {
  const keyPrefix = options.keyPrefix || "global";
  const keyGenerator = options.keyGenerator || defaultKeyGenerator;
  const message = options.message || "Too many requests. Please try again shortly.";

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const identity = keyGenerator(req);
    const key = `${keyPrefix}:${identity}`;
    const entry = getWindowEntry(key, now, options.windowMs);

    if (entry.count >= options.max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res.setHeader("X-RateLimit-Limit", String(options.max));
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
      res.status(429).json({ error: message });
      return;
    }

    entry.count += 1;
    const remaining = Math.max(0, options.max - entry.count);
    res.setHeader("X-RateLimit-Limit", String(options.max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
    next();
  };
}

export function authAwareRateLimitKey(req: Request) {
  const userId = (req as { user?: { id?: string } }).user?.id;
  if (userId) return `user:${userId}`;
  return `ip:${getIp(req)}`;
}
