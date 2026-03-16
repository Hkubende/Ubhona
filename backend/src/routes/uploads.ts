import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types.js";
import { getOwnedRestaurant } from "../services/restaurant.service.js";
import { completeUpload, prepareUpload } from "../services/upload.service.js";

const uploadsRouter = Router();
uploadsRouter.use(requireAuth);

async function handleRequestUpload(req: AuthRequest, res: any) {
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
      })
      .parse(req.body);
    const prepared = await prepareUpload({
      restaurantId: restaurant.id,
      fileName: body.fileName,
      fileType: body.fileType,
      assetType: body.assetType,
    });
    res.json(prepared);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to prepare upload." });
  }
}

async function handleCompleteUpload(req: AuthRequest, res: any) {
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
    const result = await completeUpload({
      restaurantId: restaurant.id,
      uploadId,
      status: body.status,
    });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to complete upload.";
    const status = /not found/i.test(message) ? 404 : 400;
    res.status(status).json({ error: message });
  }
}

uploadsRouter.post("/request", handleRequestUpload);
uploadsRouter.post("/complete", handleCompleteUpload);

// Backward compatibility for existing frontend callers
uploadsRouter.post("/", handleRequestUpload);
uploadsRouter.patch("/:id/complete", handleCompleteUpload);

export { uploadsRouter };
