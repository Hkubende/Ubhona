import * as React from "react";
import { ORDER_STATUS_OPTIONS, type Order, type OrderStatus } from "../../lib/orders";

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

function statusChipClass(status: string) {
  if (status === "completed") return "border-emerald-400/35 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200";
  if (status === "cancelled") return "border-red-400/35 bg-red-500/15 text-red-700 dark:text-red-200";
  if (status === "ready") return "border-cyan-400/35 bg-cyan-500/15 text-cyan-700 dark:text-cyan-200";
  if (status === "preparing") return "border-orange-400/35 bg-orange-500/15 text-orange-700 dark:text-orange-200";
  if (status === "confirmed") return "border-indigo-400/35 bg-indigo-500/15 text-indigo-700 dark:text-indigo-200";
  return "border-border bg-[color:var(--ui-note-icon-bg)] text-text-primary/85";
}

type OrderCardProps = {
  order: Order;
  expanded: boolean;
  onToggleExpanded: () => void;
  onSetStatus: (status: OrderStatus) => void;
};

export default function OrderCard({ order, expanded, onToggleExpanded, onSetStatus }: OrderCardProps) {
  return (
    <div className="ui-panel-inset rounded-3xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary/58">Order Reference</div>
          <div className="font-mono text-xs text-text-secondary/78">{order.id}</div>
          <div className="text-xs text-text-secondary/58">{new Date(order.createdAt).toLocaleString("en-KE")}</div>
          {(order.customerName || order.customerPhone || order.tableNumber) ? (
            <div className="mt-2 grid gap-1 text-xs text-text-secondary/78 sm:grid-cols-3">
              <div>Customer: {order.customerName || "-"}</div>
              <div>Phone: {order.customerPhone || "-"}</div>
              <div>Table: {order.tableNumber || "-"}</div>
            </div>
          ) : null}
        </div>
        <div className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusChipClass(order.status)}`}>
          {order.status}
        </div>
        <div className="font-bold text-primary">{formatKsh(order.total)}</div>
        <button
          onClick={onToggleExpanded}
          className="ui-button-secondary rounded-xl px-3 py-1.5 text-xs font-semibold"
        >
          {expanded ? "Hide Items" : "View Items"}
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-2">
          <div className="rounded-2xl border border-border bg-surface p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-secondary/58">Items</div>
            {order.items.map((item) => (
              <div key={`${order.id}-${item.dishId}`} className="mb-2 flex items-center justify-between text-sm last:mb-0">
                <div>{item.quantity} x {item.name}</div>
                <div className="text-primary">{formatKsh(item.subtotal)}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
            {ORDER_STATUS_OPTIONS.map((status) => {
              const active = order.status === status;
              return (
                <button
                  key={`${order.id}-${status}`}
                  onClick={() => onSetStatus(status)}
                  className={`rounded-xl border px-2 py-2 text-xs font-semibold ${
                    active
                      ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
                      : "border-border bg-[color:var(--ui-note-icon-bg)] text-text-secondary/75 hover:bg-[color:var(--ui-hover-surface)]"
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
