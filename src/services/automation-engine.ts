import { api } from "../lib/api";
import { isApiConfigured } from "../lib/config";
import { printCustomerReceipt, printKitchenTicket, printPaymentReceipt, type PrintOrder } from "../lib/print";
import { updateRestaurantDish } from "../lib/restaurant-dishes";
import { platformStore, type PlatformRole } from "../state/platform-store";

export type AutomationEventType =
  | "ORDER_CREATED"
  | "PAYMENT_COMPLETED"
  | "PAYMENT_FAILED"
  | "ORDER_STATUS_CHANGED"
  | "ORDER_OVERDUE"
  | "LOW_STOCK"
  | "PRINTER_OFFLINE";

export type AutomationActionType =
  | "print_kitchen_ticket"
  | "print_receipt"
  | "send_whatsapp_update"
  | "send_director_thank_you"
  | "flag_order_overdue"
  | "mark_dish_unavailable"
  | "notify_manager"
  | "route_to_branch_queue";

export type AutomationSettings = {
  auto_print_kitchen_tickets: boolean;
  auto_print_receipts: boolean;
  whatsapp_status_updates_enabled: boolean;
  director_thank_you_enabled: boolean;
  overdue_threshold_minutes: number;
  auto_hide_unavailable_dishes: boolean;
  notify_manager_on_overdue: boolean;
  print_on_order_created: boolean;
  print_on_order_confirmed: boolean;
  branch_defaults: Record<string, Partial<AutomationSettings>>;
  updatedAt?: string;
};

export type AutomationEventContext = {
  restaurantId: string;
  branchId?: string | null;
  role?: PlatformRole;
  order?: {
    id: string;
    createdAt: string;
    customerName?: string;
    customerPhone?: string;
    tableNumber?: string;
    customerNotes?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    paymentReference?: string;
    subtotal: number;
    total: number;
    items: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number }>;
    status?: string;
  };
  dish?: {
    id: string;
    name?: string;
    restaurantId: string;
  };
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type AutomationEvent = {
  id?: string;
  type: AutomationEventType;
  timestamp?: string;
  context: AutomationEventContext;
};

const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  auto_print_kitchen_tickets: true,
  auto_print_receipts: true,
  whatsapp_status_updates_enabled: true,
  director_thank_you_enabled: true,
  overdue_threshold_minutes: 20,
  auto_hide_unavailable_dishes: false,
  notify_manager_on_overdue: true,
  print_on_order_created: true,
  print_on_order_confirmed: true,
  branch_defaults: {},
};

const SETTINGS_KEY = "ubhona_automation_settings_v1";
const BRANCH_KEY = "ubhona_branch_context_v1";
const processedKeys = new Set<string>();

function nowIso() {
  return new Date().toISOString();
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function serializeOrderForPrint(order: NonNullable<AutomationEventContext["order"]>): PrintOrder {
  return {
    id: order.id,
    restaurant: {
      name: "Ubhona Restaurant",
      footerText: "Powered by Ubhona",
    },
    createdAt: order.createdAt,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    tableNumber: order.tableNumber,
    notes: order.customerNotes,
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    })),
    subtotal: order.subtotal,
    total: order.total,
    payment: {
      status: order.paymentStatus || "pending",
      method: order.paymentMethod || "manual_mpesa",
      transactionId: order.paymentReference,
      paidAmount: String(order.paymentStatus || "").toLowerCase() === "paid" ? order.total : undefined,
    },
  };
}

function loadLocalSettings(): AutomationSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return DEFAULT_AUTOMATION_SETTINGS;
    return {
      ...DEFAULT_AUTOMATION_SETTINGS,
      ...parsed,
      branch_defaults: toRecord((parsed as Record<string, unknown>).branch_defaults) as Record<
        string,
        Partial<AutomationSettings>
      >,
    };
  } catch {
    return DEFAULT_AUTOMATION_SETTINGS;
  }
}

function saveLocalSettings(settings: AutomationSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getCurrentBranchId() {
  try {
    const raw = localStorage.getItem(BRANCH_KEY);
    if (!raw) return "main";
    const parsed = JSON.parse(raw) as { branchId?: unknown } | null;
    const branchId = String(parsed?.branchId || "").trim();
    return branchId || "main";
  } catch {
    return "main";
  }
}

function mergeBranchSettings(settings: AutomationSettings, branchId?: string | null): AutomationSettings {
  const id = String(branchId || "").trim();
  if (!id) return settings;
  const branchDefaults = toRecord(settings.branch_defaults[id]) as Partial<AutomationSettings>;
  return {
    ...settings,
    ...branchDefaults,
    branch_defaults: settings.branch_defaults,
  };
}

export async function getAutomationSettings(branchId?: string | null) {
  let settings = loadLocalSettings();
  if (isApiConfigured) {
    try {
      const response = await api.get<unknown>("/restaurants/me/automation-settings");
      settings = {
        ...DEFAULT_AUTOMATION_SETTINGS,
        ...toRecord(response),
        branch_defaults: toRecord(toRecord(response).branch_defaults) as Record<string, Partial<AutomationSettings>>,
      };
      saveLocalSettings(settings);
    } catch {
      // keep local fallback
    }
  }
  return mergeBranchSettings(settings, branchId);
}

export async function updateAutomationSettings(patch: Partial<AutomationSettings>) {
  const current = await getAutomationSettings();
  const next = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
  };
  saveLocalSettings(next);
  if (isApiConfigured) {
    try {
      const response = await api.patch<unknown>("/restaurants/me/automation-settings", patch);
      const saved = {
        ...DEFAULT_AUTOMATION_SETTINGS,
        ...toRecord(response),
        branch_defaults: toRecord(toRecord(response).branch_defaults) as Record<string, Partial<AutomationSettings>>,
      };
      saveLocalSettings(saved);
      return saved;
    } catch {
      return next;
    }
  }
  return next;
}

async function logAutomationActivity(input: {
  action: string;
  entityType: string;
  entityId: string;
  branchId?: string | null;
  metadata?: Record<string, unknown>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}) {
  if (!isApiConfigured) return;
  try {
    await api.post("/restaurants/me/automation-events", input);
  } catch {
    // never break operational flow on logging
  }
}

async function executeAction(action: AutomationActionType, event: AutomationEvent, settings: AutomationSettings) {
  const branchId = event.context.branchId || getCurrentBranchId();
  const order = event.context.order;

  if (action === "route_to_branch_queue") {
    platformStore.recordWorkflowEvent({
      restaurantId: event.context.restaurantId,
      orderId: order?.id,
      role: event.context.role || "manager",
      stage: "order_assigned",
      message: `Automation routed event to branch queue ${branchId}.`,
      metadata: { branchId, eventType: event.type },
    });
    await logAutomationActivity({
      action: "automation_routed_to_branch_queue",
      entityType: "order",
      entityId: order?.id || event.id || "event",
      branchId,
      metadata: { eventType: event.type },
    });
    return;
  }

  if (action === "print_kitchen_ticket" && order) {
    const result = await printKitchenTicket(serializeOrderForPrint(order), { trigger: "auto" });
    await logAutomationActivity({
      action: result.ok && !result.skipped ? "automation_printed_kitchen_ticket" : "automation_print_kitchen_ticket_failed",
      entityType: "order",
      entityId: order.id,
      branchId,
      metadata: { result },
    });
    if (!result.ok) {
      await emitAutomationEvent({
        type: "PRINTER_OFFLINE",
        context: {
          restaurantId: event.context.restaurantId,
          branchId,
          role: event.context.role,
          order,
          metadata: { reason: result.message || "print_transport_failed", transport: result.transport },
        },
      });
    }
    return;
  }

  if (action === "print_receipt" && order) {
    const result = String(order.paymentStatus || "").toLowerCase() === "paid"
      ? await printPaymentReceipt(serializeOrderForPrint(order), { trigger: "auto" })
      : await printCustomerReceipt(serializeOrderForPrint(order), { trigger: "auto" });
    await logAutomationActivity({
      action: result.ok && !result.skipped ? "automation_printed_receipt" : "automation_print_receipt_failed",
      entityType: "order",
      entityId: order.id,
      branchId,
      metadata: { result },
    });
    if (!result.ok) {
      await emitAutomationEvent({
        type: "PRINTER_OFFLINE",
        context: {
          restaurantId: event.context.restaurantId,
          branchId,
          role: event.context.role,
          order,
          metadata: { reason: result.message || "print_transport_failed", transport: result.transport },
        },
      });
    }
    return;
  }

  if (action === "send_whatsapp_update" && order) {
    await logAutomationActivity({
      action: "automation_whatsapp_update_delegated",
      entityType: "order",
      entityId: order.id,
      branchId,
      metadata: { delegatedTo: "backend_order_status_notifications", enabled: settings.whatsapp_status_updates_enabled },
    });
    return;
  }

  if (action === "send_director_thank_you" && order) {
    await logAutomationActivity({
      action: "automation_director_thank_you_delegated",
      entityType: "order",
      entityId: order.id,
      branchId,
      metadata: { delegatedTo: "backend_order_status_notifications", enabled: settings.director_thank_you_enabled },
    });
    return;
  }

  if (action === "flag_order_overdue" && order) {
    platformStore.recordWorkflowEvent({
      restaurantId: event.context.restaurantId,
      orderId: order.id,
      role: event.context.role || "manager",
      stage: "order_assigned",
      message: `Order ${order.id} flagged overdue.`,
      metadata: { overdue: true, branchId },
    });
    await logAutomationActivity({
      action: "automation_flagged_order_overdue",
      entityType: "order",
      entityId: order.id,
      branchId,
      metadata: { overdueThresholdMinutes: settings.overdue_threshold_minutes },
      before: event.context.before,
      after: { overdue: true },
    });
    return;
  }

  if (action === "mark_dish_unavailable" && event.context.dish) {
    const dish = event.context.dish;
    await updateRestaurantDish(dish.id, { isAvailable: false });
    await logAutomationActivity({
      action: "automation_marked_dish_unavailable",
      entityType: "dish",
      entityId: dish.id,
      branchId,
      metadata: event.context.metadata,
      before: { isAvailable: true },
      after: { isAvailable: false },
    });
    return;
  }

  if (action === "notify_manager") {
    platformStore.recordWorkflowEvent({
      restaurantId: event.context.restaurantId,
      orderId: order?.id,
      role: "manager",
      stage: "order_assigned",
      message: `Automation notification: ${event.type.replaceAll("_", " ").toLowerCase()}.`,
      metadata: {
        branchId,
        ...event.context.metadata,
      },
    });
    await logAutomationActivity({
      action: "automation_notified_manager",
      entityType: order ? "order" : event.context.dish ? "dish" : "automation_event",
      entityId: order?.id || event.context.dish?.id || event.id || "event",
      branchId,
      metadata: { eventType: event.type, ...event.context.metadata },
    });
  }
}

function resolveActionsForEvent(event: AutomationEvent, settings: AutomationSettings): AutomationActionType[] {
  const actions: AutomationActionType[] = ["route_to_branch_queue"];
  if (event.type === "ORDER_CREATED") {
    if (settings.auto_print_kitchen_tickets && settings.print_on_order_created) actions.push("print_kitchen_ticket");
  } else if (event.type === "ORDER_STATUS_CHANGED") {
    const next = String(event.context.after?.status || event.context.order?.status || "").toLowerCase();
    if (settings.whatsapp_status_updates_enabled) actions.push("send_whatsapp_update");
    if (next === "confirmed" && settings.auto_print_kitchen_tickets && settings.print_on_order_confirmed) {
      actions.push("print_kitchen_ticket");
    }
    if (next === "completed" && settings.director_thank_you_enabled) actions.push("send_director_thank_you");
  } else if (event.type === "PAYMENT_COMPLETED") {
    if (settings.auto_print_receipts) actions.push("print_receipt");
  } else if (event.type === "ORDER_OVERDUE") {
    actions.push("flag_order_overdue");
    if (settings.notify_manager_on_overdue) actions.push("notify_manager");
  } else if (event.type === "LOW_STOCK") {
    if (settings.auto_hide_unavailable_dishes) actions.push("mark_dish_unavailable");
    else actions.push("notify_manager");
  } else if (event.type === "PRINTER_OFFLINE" || event.type === "PAYMENT_FAILED") {
    actions.push("notify_manager");
  }
  return actions;
}

function eventKey(event: AutomationEvent) {
  const base = `${event.type}:${event.context.restaurantId}:${event.context.branchId || "main"}:${event.context.order?.id || event.context.dish?.id || "na"}`;
  const marker =
    String(event.context.after?.status || "") ||
    String(event.context.metadata?.paymentStatus || "") ||
    String(event.context.metadata?.reason || "");
  return `${base}:${marker}`;
}

export async function emitAutomationEvent(eventInput: AutomationEvent) {
  const event: AutomationEvent = {
    ...eventInput,
    id: eventInput.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: eventInput.timestamp || nowIso(),
    context: {
      ...eventInput.context,
      branchId: eventInput.context.branchId || getCurrentBranchId(),
    },
  };
  const key = eventKey(event);
  if (processedKeys.has(key)) return;
  processedKeys.add(key);
  if (processedKeys.size > 500) {
    const first = processedKeys.values().next().value;
    if (first) processedKeys.delete(first);
  }
  const settings = await getAutomationSettings(event.context.branchId);
  const actions = resolveActionsForEvent(event, settings);
  for (const action of actions) {
    try {
      await executeAction(action, event, settings);
    } catch (error) {
      await logAutomationActivity({
        action: "automation_action_failed",
        entityType: event.context.order ? "order" : event.context.dish ? "dish" : "automation_event",
        entityId: event.context.order?.id || event.context.dish?.id || event.id || "event",
        branchId: event.context.branchId,
        metadata: {
          action,
          eventType: event.type,
          error: error instanceof Error ? error.message : "unknown_error",
        },
      });
    }
  }
}

export async function emitLowStockEvent(input: {
  restaurantId: string;
  dish: { id: string; restaurantId: string; name?: string };
  branchId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await emitAutomationEvent({
    type: "LOW_STOCK",
    context: {
      restaurantId: input.restaurantId,
      branchId: input.branchId || getCurrentBranchId(),
      role: "manager",
      dish: input.dish,
      metadata: input.metadata,
    },
  });
}

export function getOrderOverdueState(input: {
  createdAt: string;
  status: string;
  overdueThresholdMinutes: number;
}) {
  const status = String(input.status || "").toLowerCase();
  if (!["pending", "placed", "confirmed", "preparing"].includes(status)) return { overdue: false, elapsedMinutes: 0 };
  const createdAtMs = new Date(input.createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) return { overdue: false, elapsedMinutes: 0 };
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - createdAtMs) / 60000));
  return {
    overdue: elapsedMinutes >= Math.max(5, input.overdueThresholdMinutes),
    elapsedMinutes,
  };
}
