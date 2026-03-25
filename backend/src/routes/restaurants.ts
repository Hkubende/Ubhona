import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types.js";
import {
  createRestaurant,
  getRestaurantBySlug,
  getOwnedRestaurant,
  updateRestaurant,
} from "../services/restaurant.service.js";
import { prisma } from "../prisma.js";
import {
  mapSubscriptionSummary,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUSES,
} from "../services/subscription.service.js";
import { getRestaurantBillingSnapshot, upgradeRestaurantPlan } from "../services/billing.service.js";
import {
  getRestaurantWhatsAppSettings,
  getWhatsAppLogsForRestaurant,
  updateRestaurantWhatsAppSettings,
} from "../services/whatsapp.service.js";
import {
  createApprovalRequest,
  getRestaurantActivityHistory,
  listApprovalRequests,
  recordActivityEvent,
  requiresApprovalForAction,
  reviewApprovalRequest,
  type ApprovalStatus,
} from "../services/activity.service.js";
import { listBranchDishStockOverrides } from "../services/stock.service.js";

export const restaurantRouter = Router();
type OwnedRestaurant = NonNullable<Awaited<ReturnType<typeof getOwnedRestaurant>>>;
const AUTOMATION_SETTINGS_KEY_PREFIX = "automation_settings:";
const DEFAULT_AUTOMATION_SETTINGS = {
  auto_print_kitchen_tickets: true,
  auto_print_receipts: true,
  whatsapp_status_updates_enabled: true,
  director_thank_you_enabled: true,
  overdue_threshold_minutes: 20,
  auto_hide_unavailable_dishes: false,
  notify_manager_on_overdue: true,
  print_on_order_created: true,
  print_on_order_confirmed: true,
  branch_defaults: {} as Prisma.InputJsonObject,
  updatedAt: new Date(0).toISOString(),
};

function automationSettingsKey(restaurantId: string) {
  return `${AUTOMATION_SETTINGS_KEY_PREFIX}${restaurantId}`;
}

function toLooseRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function withSubscription(restaurant: OwnedRestaurant) {
  const billing = await getRestaurantBillingSnapshot(restaurant);
  return {
    ...restaurant,
    subscription: {
      ...mapSubscriptionSummary(restaurant),
      ...billing.subscription,
    },
    plan: billing.plan,
    entitlements: billing.entitlements,
    usage: {
      dishes: billing.entitlements.find((item) => item.featureKey === "dishes")?.currentUsage ?? 0,
      ordersPerMonth:
        billing.entitlements.find((item) => item.featureKey === "ordersPerMonth")?.currentUsage ?? 0,
    },
  };
}

restaurantRouter.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const body = z
      .object({
        name: z.string().min(1),
        slug: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().email(),
        location: z.string().min(1),
        logoUrl: z.string().optional(),
        coverImage: z.string().optional(),
        themePrimary: z.string().optional(),
        themeSecondary: z.string().optional(),
        shortDescription: z.string().optional(),
      })
      .parse(req.body);
    const restaurant = await createRestaurant(req.user!.id, body);
    res.json(await withSubscription(restaurant));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create restaurant." });
  }
});

restaurantRouter.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  res.json(await withSubscription(restaurant));
});

restaurantRouter.patch("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const existing = await getOwnedRestaurant(req.user!.id);
    if (!existing) {
      res.status(404).json({ error: "Restaurant not found." });
      return;
    }
    const body = z
      .object({
        name: z.string().optional(),
        slug: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        location: z.string().optional(),
        logoUrl: z.string().optional(),
        coverImage: z.string().optional(),
        themePrimary: z.string().optional(),
        themeSecondary: z.string().optional(),
        shortDescription: z.string().optional(),
      })
      .parse(req.body);
    const changedKeys = Object.keys(body).filter((key) => {
      const beforeValue = (existing as Record<string, unknown>)[key];
      const afterValue = (body as Record<string, unknown>)[key];
      return JSON.stringify(beforeValue ?? null) !== JSON.stringify(afterValue ?? null);
    });
    if (!changedKeys.length) {
      res.json(await withSubscription(existing));
      return;
    }
    if (
      requiresApprovalForAction({
        actionType: "settings_update",
        role: req.user!.role,
      })
    ) {
      const approval = await createApprovalRequest({
        actionType: "settings_update",
        entityType: "restaurant",
        entityId: existing.id,
        organizationId: existing.id,
        restaurantId: existing.id,
        requestedByUserId: req.user!.id,
        requestedByRole: req.user!.role,
        requestPayload: {
          changedKeys,
          patch: body,
        },
        reason: "Restaurant settings update requires approval.",
      });
      res.status(202).json({
        ok: true,
        requiresApproval: true,
        approvalId: approval.id,
        message: "Settings update submitted for approval.",
      });
      return;
    }
    const restaurant = await updateRestaurant(req.user!.id, body);
    if (!restaurant) {
      res.status(404).json({ error: "Restaurant not found." });
      return;
    }
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: "restaurant_settings_updated",
      entityType: "restaurant",
      entityId: restaurant.id,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      source: "restaurant_settings",
      before: changedKeys.reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = (existing as Record<string, unknown>)[key];
        return acc;
      }, {}),
      after: changedKeys.reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = (restaurant as Record<string, unknown>)[key];
        return acc;
      }, {}),
      metadata: { changedKeys },
    });
    res.json(await withSubscription(restaurant));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update restaurant." });
  }
});

restaurantRouter.patch("/me/plan", requireAuth, async (req: AuthRequest, res) => {
  try {
    const body = z
      .object({
        subscriptionPlan: z.enum(SUBSCRIPTION_PLANS),
        subscriptionStatus: z.enum(SUBSCRIPTION_STATUSES).optional(),
        billingCycle: z.enum(["monthly", "annual"]).optional(),
        provider: z.enum(["mpesa", "manual", "stripe"]).optional(),
      })
      .parse(req.body);
    const restaurant = await getOwnedRestaurant(req.user!.id);
    if (!restaurant) {
      res.status(404).json({ error: "Restaurant not found." });
      return;
    }
    const state = await upgradeRestaurantPlan({
      restaurant,
      planId: body.subscriptionPlan,
      billingCycle: body.billingCycle,
      provider: body.provider,
    });
    const refreshed = await prisma.restaurant.findUnique({ where: { id: restaurant.id } });
    if (!refreshed) {
      res.status(404).json({ error: "Restaurant not found." });
      return;
    }
    res.json({
      ...(await withSubscription(refreshed)),
      invoices: state.invoices.slice(0, 5),
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update plan." });
  }
});

restaurantRouter.get("/:slug/categories", async (req, res) => {
  const restaurant = await getRestaurantBySlug(req.params.slug);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  const categories = await prisma.category.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json(categories);
});

restaurantRouter.get("/:slug/dishes", async (req, res) => {
  const restaurant = await getRestaurantBySlug(req.params.slug);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  const branchId = String(req.query.branchId || "").trim() || "main";
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, isAvailable: true },
    orderBy: { createdAt: "desc" },
  });
  const overrides = await listBranchDishStockOverrides({ restaurantId: restaurant.id, branchId });
  const overrideByDishId = new Map(overrides.map((item) => [item.dishId, item]));
  const automationRow = await prisma.platformTrackerDocument.findUnique({
    where: { key: automationSettingsKey(restaurant.id) },
    select: { payload: true },
  });
  const automationSettings = {
    ...DEFAULT_AUTOMATION_SETTINGS,
    ...toLooseRecord(automationRow?.payload),
  };
  const autoHideUnavailable = Boolean(automationSettings.auto_hide_unavailable_dishes);
  const filtered = dishes
    .map((dish) => {
      const override = overrideByDishId.get(dish.id);
      if (!override) {
        return {
          ...dish,
          availability_status: "available",
          stock_quantity: null,
          low_stock_threshold: 5,
          hidden_from_public_menu: false,
          branchId,
        };
      }
      return {
        ...dish,
        availability_status: override.availability_status,
        stock_quantity: override.stock_quantity,
        low_stock_threshold: override.low_stock_threshold,
        hidden_from_public_menu: override.hidden_from_public_menu,
        branchId,
      };
    })
    .filter((dish) => !dish.hidden_from_public_menu)
    .filter((dish) => (autoHideUnavailable ? dish.availability_status !== "unavailable" : true))
    .map((dish) => ({
      ...dish,
      isAvailable: dish.isAvailable && dish.availability_status !== "unavailable",
    }));
  res.json(filtered);
});

restaurantRouter.get("/:slug", async (req, res) => {
  const restaurant = await getRestaurantBySlug(req.params.slug);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  res.json(await withSubscription(restaurant));
});

restaurantRouter.get("/me/whatsapp-settings", requireAuth, async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  const settings = await getRestaurantWhatsAppSettings(restaurant.id);
  res.json(settings);
});

restaurantRouter.patch("/me/whatsapp-settings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!.id);
    if (!restaurant) {
      res.status(404).json({ error: "Restaurant not found." });
      return;
    }
    const body = z
      .object({
        enabled: z.boolean().optional(),
        directorName: z.string().trim().min(2).max(120).optional(),
        senderBehavior: z.enum(["default", "restaurant"]).optional(),
        provider: z.enum(["mock", "meta_cloud", "twilio"]).optional(),
      })
      .parse(req.body);
    const previous = await getRestaurantWhatsAppSettings(restaurant.id);
    const changed = Object.entries(body).filter(([key, value]) => {
      const before = (previous as Record<string, unknown>)[key];
      return JSON.stringify(before ?? null) !== JSON.stringify(value ?? null);
    });
    if (
      changed.length > 0 &&
      requiresApprovalForAction({
        actionType: "payment_settings_update",
        role: req.user!.role,
      })
    ) {
      const approval = await createApprovalRequest({
        actionType: "payment_settings_update",
        entityType: "whatsapp_settings",
        entityId: restaurant.id,
        organizationId: restaurant.id,
        restaurantId: restaurant.id,
        requestedByUserId: req.user!.id,
        requestedByRole: req.user!.role,
        requestPayload: {
          changedKeys: changed.map(([key]) => key),
          patch: body,
        },
        reason: "Messaging/payment settings update requires approval.",
      });
      res.status(202).json({
        ok: true,
        requiresApproval: true,
        approvalId: approval.id,
        message: "WhatsApp settings update submitted for approval.",
      });
      return;
    }
    const settings = await updateRestaurantWhatsAppSettings(restaurant.id, body);
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: "payment_settings_updated",
      entityType: "whatsapp_settings",
      entityId: restaurant.id,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      source: "settings_whatsapp",
      before: previous as unknown as Record<string, unknown>,
      after: settings as unknown as Record<string, unknown>,
      metadata: { changedKeys: changed.map(([key]) => key) },
    });
    res.json(settings);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update WhatsApp settings." });
  }
});

restaurantRouter.get("/me/activity", requireAuth, async (req: AuthRequest, res) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!.id);
    if (!restaurant) {
      res.status(404).json({ error: "Restaurant not found." });
      return;
    }
    const query = z
      .object({
        limit: z.coerce.number().int().positive().max(200).optional(),
        entityType: z.string().optional(),
        entityId: z.string().optional(),
      })
      .parse(req.query);
    const rows = await getRestaurantActivityHistory({
      restaurantId: restaurant.id,
      limit: query.limit,
      entityType: query.entityType,
      entityId: query.entityId,
    });
    res.json(rows);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to load activity history." });
  }
});

restaurantRouter.get("/me/orders/:orderId/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!.id);
    if (!restaurant) {
      res.status(404).json({ error: "Restaurant not found." });
      return;
    }
    const rows = await getRestaurantActivityHistory({
      restaurantId: restaurant.id,
      entityType: "order",
      entityId: req.params.orderId,
      limit: Math.max(1, Math.min(100, Number(req.query.limit || 50))),
    });
    res.json(rows);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to load order history." });
  }
});

restaurantRouter.get("/me/dishes/:dishId/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!.id);
    if (!restaurant) {
      res.status(404).json({ error: "Restaurant not found." });
      return;
    }
    const rows = await getRestaurantActivityHistory({
      restaurantId: restaurant.id,
      entityType: "dish",
      entityId: req.params.dishId,
      limit: Math.max(1, Math.min(100, Number(req.query.limit || 50))),
    });
    res.json(rows);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to load dish history." });
  }
});

restaurantRouter.get("/me/approvals", requireAuth, async (req: AuthRequest, res) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!.id);
    if (!restaurant) {
      res.status(404).json({ error: "Restaurant not found." });
      return;
    }
    const query = z
      .object({
        status: z.enum(["pending", "approved", "rejected"]).optional(),
        limit: z.coerce.number().int().positive().max(200).optional(),
      })
      .parse(req.query);
    const approvals = await listApprovalRequests({
      restaurantId: restaurant.id,
      status: query.status as ApprovalStatus | undefined,
      limit: query.limit,
    });
    res.json(approvals);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to load approvals." });
  }
});

restaurantRouter.post("/me/approvals/:approvalId/review", requireAuth, async (req: AuthRequest, res) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!.id);
    if (!restaurant) {
      res.status(404).json({ error: "Restaurant not found." });
      return;
    }
    const body = z
      .object({
        decision: z.enum(["approved", "rejected"]),
        note: z.string().max(500).optional(),
      })
      .parse(req.body || {});
    const approval = await reviewApprovalRequest({
      restaurantId: restaurant.id,
      approvalId: req.params.approvalId,
      decision: body.decision,
      reviewerUserId: req.user!.id,
      reviewerRole: req.user!.role,
      note: body.note,
    });
    res.json(approval);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to review approval." });
  }
});

restaurantRouter.get("/me/whatsapp-logs", requireAuth, async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
  const logs = await getWhatsAppLogsForRestaurant(restaurant.id, limit);
  res.json(logs);
});

restaurantRouter.get("/me/automation-settings", requireAuth, async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  const row = await prisma.platformTrackerDocument.findUnique({
    where: { key: automationSettingsKey(restaurant.id) },
    select: { payload: true },
  });
  const payload = toLooseRecord(row?.payload);
  res.json({
    ...DEFAULT_AUTOMATION_SETTINGS,
    ...payload,
  });
});

restaurantRouter.patch("/me/automation-settings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!.id);
    if (!restaurant) {
      res.status(404).json({ error: "Restaurant not found." });
      return;
    }
    const patch = z
      .object({
        auto_print_kitchen_tickets: z.boolean().optional(),
        auto_print_receipts: z.boolean().optional(),
        whatsapp_status_updates_enabled: z.boolean().optional(),
        director_thank_you_enabled: z.boolean().optional(),
        overdue_threshold_minutes: z.number().int().min(5).max(240).optional(),
        auto_hide_unavailable_dishes: z.boolean().optional(),
        notify_manager_on_overdue: z.boolean().optional(),
        print_on_order_created: z.boolean().optional(),
        print_on_order_confirmed: z.boolean().optional(),
        branch_defaults: z.record(z.unknown()).optional(),
      })
      .parse(req.body || {});
    const existingRow = await prisma.platformTrackerDocument.findUnique({
      where: { key: automationSettingsKey(restaurant.id) },
      select: { payload: true },
    });
    const existing = {
      ...DEFAULT_AUTOMATION_SETTINGS,
      ...toLooseRecord(existingRow?.payload),
    };
    const next = {
      ...existing,
      ...patch,
      branch_defaults: patch.branch_defaults
        ? (patch.branch_defaults as Prisma.InputJsonObject)
        : ((existing.branch_defaults as Prisma.InputJsonObject) || ({} as Prisma.InputJsonObject)),
      updatedAt: new Date().toISOString(),
    };
    await prisma.platformTrackerDocument.upsert({
      where: { key: automationSettingsKey(restaurant.id) },
      create: {
        key: automationSettingsKey(restaurant.id),
        payload: next as Prisma.InputJsonValue,
      },
      update: {
        payload: next as Prisma.InputJsonValue,
      },
    });
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: "automation_settings_updated",
      entityType: "automation_settings",
      entityId: restaurant.id,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      source: "automation_settings_api",
      before: existing as unknown as Record<string, unknown>,
      after: next as unknown as Record<string, unknown>,
    });
    res.json(next);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update automation settings." });
  }
});

restaurantRouter.post("/me/automation-events", requireAuth, async (req: AuthRequest, res) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!.id);
    if (!restaurant) {
      res.status(404).json({ error: "Restaurant not found." });
      return;
    }
    const body = z
      .object({
        action: z.string().min(1),
        entityType: z.string().min(1),
        entityId: z.string().min(1),
        branchId: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
        before: z.record(z.unknown()).optional(),
        after: z.record(z.unknown()).optional(),
      })
      .parse(req.body || {});
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: body.action,
      entityType: body.entityType,
      entityId: body.entityId,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      branchId: body.branchId || null,
      source: "automation_engine",
      before: body.before,
      after: body.after,
      metadata: body.metadata,
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to record automation event." });
  }
});
