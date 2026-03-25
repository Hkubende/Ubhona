import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types.js";
import { getOwnedRestaurant } from "../services/restaurant.service.js";
import {
  attachOrderToSession,
  closeTableSession,
  completeCleaning,
  createReservation,
  getFloorSnapshot,
  openTableSession,
  setTableStatus,
  upsertFloorTable,
  updateReservation,
} from "../services/floor.service.js";
import { recordActivityEvent } from "../services/activity.service.js";

export const floorRouter = Router();
floorRouter.use(requireAuth);

function canAccess(role: string) {
  return role === "platform_admin" || role === "restaurant_owner" || role === "restaurant_manager" || role === "staff";
}

function canMutate(role: string) {
  return canAccess(role);
}

floorRouter.get("/snapshot", async (req: AuthRequest, res) => {
  if (!canAccess(req.user!.role)) {
    res.status(403).json({ error: "You do not have access to floor operations." });
    return;
  }
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  const query = z
    .object({
      branchId: z.string().trim().optional(),
      idleThresholdMinutes: z.coerce.number().int().positive().max(720).optional(),
    })
    .safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params." });
    return;
  }
  const snapshot = await getFloorSnapshot({
    restaurantId: restaurant.id,
    branchId: query.data.branchId || "main",
    idleThresholdMinutes: query.data.idleThresholdMinutes,
  });
  res.json(snapshot);
});

floorRouter.post("/tables", async (req: AuthRequest, res) => {
  if (!canMutate(req.user!.role)) {
    res.status(403).json({ error: "You do not have permission to update floor tables." });
    return;
  }
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        tableId: z.string().optional(),
        branchId: z.string().trim().default("main"),
        name: z.string().min(1),
        capacity: z.number().int().positive().max(30).optional(),
        positionX: z.number().optional(),
        positionY: z.number().optional(),
        status: z.enum(["available", "occupied", "reserved", "cleaning"]).optional(),
      })
      .parse(req.body || {});
    const table = await upsertFloorTable({
      restaurantId: restaurant.id,
      branchId: body.branchId,
      tableId: body.tableId,
      name: body.name,
      capacity: body.capacity,
      positionX: body.positionX,
      positionY: body.positionY,
      status: body.status,
    });
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: body.tableId ? "table_updated" : "table_created",
      entityType: "table",
      entityId: table.id,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      branchId: body.branchId,
      source: "floor_api",
      after: table as unknown as Record<string, unknown>,
    });
    res.status(body.tableId ? 200 : 201).json(table);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to save table." });
  }
});

floorRouter.patch("/tables/:tableId/status", async (req: AuthRequest, res) => {
  if (!canMutate(req.user!.role)) {
    res.status(403).json({ error: "You do not have permission to update table status." });
    return;
  }
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        branchId: z.string().trim().default("main"),
        status: z.enum(["available", "occupied", "reserved", "cleaning"]),
      })
      .parse(req.body || {});
    const table = await setTableStatus({
      restaurantId: restaurant.id,
      branchId: body.branchId,
      tableId: req.params.tableId,
      status: body.status,
    });
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: "table_status_changed",
      entityType: "table",
      entityId: table.id,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      branchId: body.branchId,
      source: "floor_api",
      after: table as unknown as Record<string, unknown>,
    });
    res.json(table);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update table status." });
  }
});

floorRouter.post("/reservations", async (req: AuthRequest, res) => {
  if (!canMutate(req.user!.role)) {
    res.status(403).json({ error: "You do not have permission to create reservations." });
    return;
  }
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        branchId: z.string().trim().default("main"),
        customerName: z.string().min(1),
        phone: z.string().optional(),
        partySize: z.number().int().positive().max(40),
        reservationTime: z.string().min(1),
        tableId: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(req.body || {});
    const reservation = await createReservation({
      restaurantId: restaurant.id,
      branchId: body.branchId,
      customerName: body.customerName,
      phone: body.phone,
      partySize: body.partySize,
      reservationTime: body.reservationTime,
      tableId: body.tableId,
      notes: body.notes,
    });
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: "reservation_created",
      entityType: "reservation",
      entityId: reservation.id,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      branchId: body.branchId,
      source: "floor_api",
      after: reservation as unknown as Record<string, unknown>,
    });
    res.status(201).json(reservation);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create reservation." });
  }
});

floorRouter.patch("/reservations/:reservationId", async (req: AuthRequest, res) => {
  if (!canMutate(req.user!.role)) {
    res.status(403).json({ error: "You do not have permission to update reservations." });
    return;
  }
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        branchId: z.string().trim().default("main"),
        status: z.enum(["booked", "arrived", "cancelled", "completed"]).optional(),
        tableId: z.string().nullable().optional(),
        reservationTime: z.string().optional(),
        partySize: z.number().int().positive().max(40).optional(),
        notes: z.string().nullable().optional(),
      })
      .parse(req.body || {});
    const reservation = await updateReservation({
      restaurantId: restaurant.id,
      branchId: body.branchId,
      reservationId: req.params.reservationId,
      status: body.status,
      tableId: body.tableId,
      reservationTime: body.reservationTime,
      partySize: body.partySize,
      notes: body.notes,
    });
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: "reservation_updated",
      entityType: "reservation",
      entityId: reservation.id,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      branchId: body.branchId,
      source: "floor_api",
      after: reservation as unknown as Record<string, unknown>,
    });
    res.json(reservation);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update reservation." });
  }
});

floorRouter.post("/sessions/open", async (req: AuthRequest, res) => {
  if (!canMutate(req.user!.role)) {
    res.status(403).json({ error: "You do not have permission to open table sessions." });
    return;
  }
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        branchId: z.string().trim().default("main"),
        tableId: z.string().min(1),
        assignedWaiterId: z.string().optional(),
        guestCount: z.number().int().positive().max(40).optional(),
      })
      .parse(req.body || {});
    const session = await openTableSession({
      restaurantId: restaurant.id,
      branchId: body.branchId,
      tableId: body.tableId,
      assignedWaiterId: body.assignedWaiterId,
      guestCount: body.guestCount,
    });
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: "table_session_opened",
      entityType: "table_session",
      entityId: session.id,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      branchId: body.branchId,
      source: "floor_api",
      after: session as unknown as Record<string, unknown>,
    });
    res.status(201).json(session);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to open table session." });
  }
});

floorRouter.post("/sessions/:sessionId/close", async (req: AuthRequest, res) => {
  if (!canMutate(req.user!.role)) {
    res.status(403).json({ error: "You do not have permission to close table sessions." });
    return;
  }
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        branchId: z.string().trim().default("main"),
        markStatus: z.enum(["cleaning", "available"]).optional(),
      })
      .parse(req.body || {});
    const session = await closeTableSession({
      restaurantId: restaurant.id,
      branchId: body.branchId,
      sessionId: req.params.sessionId,
      markStatus: body.markStatus,
    });
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: "table_session_closed",
      entityType: "table_session",
      entityId: session.id,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      branchId: body.branchId,
      source: "floor_api",
      after: session as unknown as Record<string, unknown>,
    });
    res.json(session);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to close table session." });
  }
});

floorRouter.post("/sessions/:sessionId/orders", async (req: AuthRequest, res) => {
  if (!canMutate(req.user!.role)) {
    res.status(403).json({ error: "You do not have permission to attach orders to table sessions." });
    return;
  }
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        branchId: z.string().trim().default("main"),
        orderId: z.string().min(1),
      })
      .parse(req.body || {});
    const session = await attachOrderToSession({
      restaurantId: restaurant.id,
      branchId: body.branchId,
      sessionId: req.params.sessionId,
      orderId: body.orderId,
    });
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: "table_session_order_attached",
      entityType: "table_session",
      entityId: session.id,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      branchId: body.branchId,
      source: "floor_api",
      metadata: { orderId: body.orderId },
    });
    res.json(session);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to attach order to session." });
  }
});

floorRouter.post("/tables/:tableId/cleaning-complete", async (req: AuthRequest, res) => {
  if (!canMutate(req.user!.role)) {
    res.status(403).json({ error: "You do not have permission to update cleaning state." });
    return;
  }
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        branchId: z.string().trim().default("main"),
      })
      .parse(req.body || {});
    const table = await completeCleaning({
      restaurantId: restaurant.id,
      branchId: body.branchId,
      tableId: req.params.tableId,
    });
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: "table_cleaning_completed",
      entityType: "table",
      entityId: table.id,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      branchId: body.branchId,
      source: "floor_api",
      after: table as unknown as Record<string, unknown>,
    });
    res.json(table);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to complete cleaning." });
  }
});
