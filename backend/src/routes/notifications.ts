import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types.js";
import { getOwnedRestaurant } from "../services/restaurant.service.js";
import {
  isStaffNotificationRole,
  listStaffNotifications,
} from "../services/notification.service.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.json([]);
    return;
  }
  const query = z
    .object({
      role: z.string().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    })
    .safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid notification query." });
    return;
  }
  const role = query.data.role && isStaffNotificationRole(query.data.role) ? query.data.role : undefined;
  const rows = await listStaffNotifications({
    restaurantId: restaurant.id,
    role,
    limit: query.data.limit,
  });
  res.json(rows);
});
