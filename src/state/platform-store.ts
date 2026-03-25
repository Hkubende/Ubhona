import { useSyncExternalStore } from "react";
import type { DashboardRole } from "../types/roles";

export type PlatformRole = DashboardRole | "customer";

export type WorkflowStage =
  | "order_created"
  | "order_assigned"
  | "kitchen_printed"
  | "customer_receipt_printed"
  | "payment_pending"
  | "payment_completed"
  | "order_completed"
  | "order_cancelled";

export type WorkflowEvent = {
  id: string;
  restaurantId: string;
  orderId?: string;
  role: PlatformRole;
  stage: WorkflowStage;
  timestamp: string;
  message: string;
  metadata?: Record<string, unknown>;
};

type PlatformState = {
  restaurantId: string;
  role: PlatformRole;
  lastUpdatedAt: string;
  orderStatusById: Record<string, string>;
  events: WorkflowEvent[];
};

const MAX_EVENTS = 200;
const listeners = new Set<() => void>();

let state: PlatformState = {
  restaurantId: "",
  role: "customer",
  lastUpdatedAt: new Date().toISOString(),
  orderStatusById: {},
  events: [],
};

function emit() {
  for (const listener of listeners) listener();
}

function setState(next: PlatformState | ((current: PlatformState) => PlatformState)) {
  state = typeof next === "function" ? next(state) : next;
  emit();
}

function createEventId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const platformStore = {
  getState() {
    return state;
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setSessionContext(input: { restaurantId: string; role: PlatformRole }) {
    setState((current) => ({
      ...current,
      restaurantId: input.restaurantId,
      role: input.role,
      lastUpdatedAt: new Date().toISOString(),
    }));
  },
  upsertOrderStatus(orderId: string, status: string) {
    setState((current) => ({
      ...current,
      lastUpdatedAt: new Date().toISOString(),
      orderStatusById: {
        ...current.orderStatusById,
        [orderId]: status,
      },
    }));
  },
  recordWorkflowEvent(input: Omit<WorkflowEvent, "id" | "timestamp">) {
    const event: WorkflowEvent = {
      ...input,
      id: createEventId(),
      timestamp: new Date().toISOString(),
    };
    setState((current) => ({
      ...current,
      lastUpdatedAt: event.timestamp,
      events: [...current.events, event].slice(-MAX_EVENTS),
    }));
    return event;
  },
};

export function usePlatformStore<T>(selector: (state: PlatformState) => T) {
  return useSyncExternalStore(
    platformStore.subscribe,
    () => selector(platformStore.getState()),
    () => selector(platformStore.getState())
  );
}

