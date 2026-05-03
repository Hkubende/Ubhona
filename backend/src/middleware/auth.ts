import type { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AuthRequest } from "../types.js";
import { prisma } from "../prisma.js";
import { getOwnedRestaurant } from "../services/restaurant.service.js";
import { runWithDbRlsContext } from "../db-rls.js";

const JWT_SECRET = String(process.env.JWT_SECRET || "").trim();
if (!JWT_SECRET || JWT_SECRET === "dev-secret" || JWT_SECRET.length < 32) {
  throw new Error("Missing or weak JWT_SECRET. Set a strong secret (>=32 chars) before starting backend.");
}

const LOG_AUTH_DEBUG =
  String(process.env.LOG_AUTH_DEBUG || "").trim().toLowerCase() === "true" || process.env.NODE_ENV !== "production";

function authDebug(message: string, details?: Record<string, unknown>) {
  if (!LOG_AUTH_DEBUG) return;
  if (details) {
    console.info(`[auth] ${message}`, details);
    return;
  }
  console.info(`[auth] ${message}`);
}

function authHeaderSummary(value: string) {
  const token = value.startsWith("Bearer ") ? value.slice(7) : "";
  return {
    hasAuthHeader: Boolean(value),
    hasBearerToken: Boolean(token),
    tokenPrefix: token.slice(0, 12),
    tokenLength: token.length,
  };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  authDebug("requireAuth.received", authHeaderSummary(authHeader));
  if (!token) {
    authDebug("requireAuth.missingToken");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; email?: string };
    authDebug("requireAuth.jwtVerified", { sub: payload.sub, email: payload.email || "" });
    let user = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true },
      });
      authDebug("requireAuth.dbLookup.success", { found: Boolean(user), userId: payload.sub });
    } catch (dbError) {
      authDebug("requireAuth.dbLookup.error", {
        userId: payload.sub,
        error: dbError instanceof Error ? dbError.message : "unknown db error",
      });
      res.status(500).json({ error: "Database unavailable while validating auth." });
      return;
    }
    if (!user) {
      authDebug("requireAuth.userNotFound", { userId: payload.sub });
      res.status(401).json({ error: "User not found." });
      return;
    }
    let restaurantId: string | undefined;
    if (user.role !== "platform_admin") {
      try {
        const restaurant = await getOwnedRestaurant(user.id);
        restaurantId = restaurant?.id;
      } catch (dbError) {
        authDebug("requireAuth.restaurantLookup.error", {
          userId: user.id,
          error: dbError instanceof Error ? dbError.message : "unknown db error",
        });
        res.status(500).json({ error: "Database unavailable while resolving tenant context." });
        return;
      }
    }

    req.user = { id: user.id, email: user.email, role: user.role, restaurantId };
    authDebug("requireAuth.userAttached", { userId: user.id, role: user.role, restaurantId: restaurantId || null });

    // The backend auth layer is responsible for supplying the DB session
    // contract used by PostgreSQL RLS. We bind per-request user/admin context
    // here, and non-admin restaurant context when available.
    runWithDbRlsContext(
      {
        userId: user.id,
        restaurantId,
        isAdmin: user.role === "platform_admin",
      },
      () => next()
    );
  } catch (error) {
    authDebug("requireAuth.jwtInvalid", { error: error instanceof Error ? error.message : "invalid token" });
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  void requireAuth(req, res, () => {
    if (req.user?.role !== "platform_admin") {
      res.status(403).json({ error: "Admin access required." });
      return;
    }
    next();
  });
}

export async function requireAppAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const resolveRestaurant = async () => {
    try {
      const restaurant = await getOwnedRestaurant(req.user!.id);
      if (!restaurant) {
        res.status(400).json({ error: "Create restaurant profile first." });
        return;
      }
      req.user = {
        ...req.user!,
        restaurantId: restaurant.id,
      };
      runWithDbRlsContext(
        {
          userId: req.user!.id,
          restaurantId: restaurant.id,
          isAdmin: req.user!.role === "platform_admin",
        },
        () => next()
      );
    } catch {
      res.status(500).json({ error: "Failed to resolve active restaurant." });
    }
  };

  if (!req.user) {
    await requireAuth(req, res, resolveRestaurant);
    return;
  }
  await resolveRestaurant();
}
