import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth, requireAppAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types.js";
import type { NextFunction, Response } from "express";
import { getOwnedRestaurant } from "../services/restaurant.service.js";
import { completeUpload, prepareUpload, uploadAssetServerManaged } from "../services/upload.service.js";
import { authAwareRateLimitKey, createRateLimiter } from "../middleware/rate-limit.js";
import { runWithRestaurantDbSession } from "../services/db-session.service.js";

const uploadsRouter = Router();
const LOG_UPLOAD_DEBUG =
  String(process.env.LOG_UPLOAD_DEBUG || "").trim().toLowerCase() === "true" || process.env.NODE_ENV !== "production";

function uploadRouteDebug(message: string, details?: Record<string, unknown>) {
  if (!LOG_UPLOAD_DEBUG) return;
  if (details) {
    console.info(`[uploads.route] ${message}`, details);
    return;
  }
  console.info(`[uploads.route] ${message}`);
}

uploadsRouter.use(requireAuth);
uploadsRouter.use(
  createRateLimiter({
    keyPrefix: "uploads",
    windowMs: 60 * 1000,
    max: 40,
    keyGenerator: authAwareRateLimitKey,
    message: "Upload rate limit exceeded. Please wait and retry.",
  })
);

async function handleRequestUpload(req: AuthRequest, res: Response) {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }

  try {
    const body = z
      .object({
        fileName: z.string().min(1),
        fileType: z.string().min(1),
        assetType: z.enum(["logo", "cover", "thumb", "model"]),
        fileSize: z.number().int().positive().max(50 * 1024 * 1024).optional(),
      })
      .parse(req.body);
    const prepared = await runWithRestaurantDbSession(
      {
        userId: req.user!.id,
        restaurantId: restaurant.id,
        isAdmin: req.user!.role === "platform_admin",
      },
      (tx) =>
        prepareUpload({
          restaurantId: restaurant.id,
          fileName: body.fileName,
          fileType: body.fileType,
          assetType: body.assetType,
          fileSize: body.fileSize,
        }, tx)
    );
    res.json(prepared);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to prepare upload." });
  }
}

async function handleCompleteUpload(req: AuthRequest, res: Response) {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        uploadId: z.string().min(1).optional(),
        status: z.enum(["uploaded", "failed"]).default("uploaded"),
      })
      .parse(req.body);
    const uploadId = body.uploadId || req.params.id;
    if (!uploadId) {
      res.status(400).json({ error: "uploadId is required." });
      return;
    }
    const result = await runWithRestaurantDbSession(
      {
        userId: req.user!.id,
        restaurantId: restaurant.id,
        isAdmin: req.user!.role === "platform_admin",
      },
      (tx) =>
        completeUpload({
          restaurantId: restaurant.id,
          uploadId,
          status: body.status,
        }, tx)
    );
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to complete upload.";
    const status = /not found/i.test(message) ? 404 : 400;
    res.status(status).json({ error: message });
  }
}

uploadsRouter.post("/request", handleRequestUpload);
uploadsRouter.post("/complete", handleCompleteUpload);

async function handleServerManagedUpload(req: AuthRequest, res: Response, assetType: "thumb" | "model") {
  try {
    const body = z
      .object({
        restaurantId: z.string().min(1),
        dishId: z.string().min(1),
      })
      .parse(req.body);
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: "Active restaurant context is missing." });
      return;
    }
    if (body.restaurantId !== req.user.restaurantId) {
      res.status(403).json({ error: "restaurantId must match your active restaurant." });
      return;
    }
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "File is required. Use multipart/form-data with field name 'file'." });
      return;
    }
    if (!Buffer.isBuffer(file.buffer) || file.buffer.byteLength <= 0) {
      res.status(400).json({ error: "Uploaded file is empty or unreadable." });
      return;
    }

    uploadRouteDebug("serverManagedUpload.request", {
      userId: req.user?.id,
      restaurantId: req.user?.restaurantId,
      dishId: body.dishId,
      assetType,
      fileName: file.originalname,
      fileType: file.mimetype || "application/octet-stream",
      fileSize: file.size,
      bufferBytes: file.buffer.byteLength,
    });

    const uploaded = await runWithRestaurantDbSession(
      {
        userId: req.user.id,
        restaurantId: req.user.restaurantId,
        isAdmin: req.user.role === "platform_admin",
      },
      (tx) =>
        uploadAssetServerManaged({
          restaurantId: req.user!.restaurantId!,
          dishId: body.dishId,
          fileName: file.originalname,
          fileType: file.mimetype || "application/octet-stream",
          bytes: file.buffer,
          assetType,
        }, tx)
    );

    const payload: Record<string, unknown> = {
      ok: true,
      url: uploaded.url,
      path: uploaded.path,
      bucket: uploaded.bucket,
    };

    if (process.env.NODE_ENV !== "production") {
      payload.debug = {
        bucket: uploaded.bucket,
        path: uploaded.path,
      };
    }

    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server-managed upload failed.";
    uploadRouteDebug("serverManagedUpload.error", { assetType, error: message });
    res.status(400).json({ error: message });
  }
}

const thumbnailUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const modelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function ensureAllowedMime(allowed: string[]) {
  const set = new Set(allowed.map((item) => item.toLowerCase()));
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "File is required." });
      return;
    }
    if (!set.has(file.mimetype.toLowerCase())) {
      res.status(400).json({ error: `Unsupported file type '${file.mimetype}'.` });
      return;
    }
    next();
  };
}

uploadsRouter.post(
  "/thumbnail",
  requireAppAuth,
  thumbnailUpload.single("file"),
  ensureAllowedMime(["image/jpeg", "image/png", "image/webp"]),
  async (req: AuthRequest, res: Response) => {
    await handleServerManagedUpload(req, res, "thumb");
  }
);

uploadsRouter.post(
  "/model",
  requireAppAuth,
  modelUpload.single("file"),
  ensureAllowedMime(["model/gltf-binary", "model/gltf+json", "application/octet-stream"]),
  async (req: AuthRequest, res: Response) => {
    await handleServerManagedUpload(req, res, "model");
  }
);

// Backward compatibility for existing frontend callers
uploadsRouter.post("/", handleRequestUpload);
uploadsRouter.patch("/:id/complete", handleCompleteUpload);

export { uploadsRouter };
