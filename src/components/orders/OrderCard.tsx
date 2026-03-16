import * as React from "react";
import { ORDER_STATUS_OPTIONS, type Order, type OrderStatus } from "../../lib/orders";

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

function statusChipClass(status: string) {
  if (status === "completed") return "border-emerald-400/35 bg-emerald-500/20 text-emerald-200";
  if (status === "ready") return "border-cyan-400/35 bg-cyan-500/20 text-cyan-200";
  if (status === "preparing") return "border-orange-400/35 bg-orange-500/20 text-orange-200";
  if (status === "confirmed") return "border-indigo-400/35 bg-indigo-500/20 text-indigo-200";
  return "border-white/20 bg-white/10 text-white/85";
}

type OrderCardProps = {
  order: Order;
  expanded: boolean;
  onToggleExpanded: () => void;
  onSetStatus: (status: OrderStatus) => void;
};

export default function OrderCard({ order, expanded, onToggleExpanded, onSetStatus }: OrderCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-xs text-white/70">{order.id}</div>
          <div className="text-xs text-white/50">{new Date(order.createdAt).toLocaleString("en-KE")}</div>
          {(order.customerName || order.customerPhone || order.tableNumber) ? (
            <div className="mt-2 grid gap-1 text-xs text-white/70 sm:grid-cols-3">
              <div>Customer: {order.customerName || "-"}</div>
              <div>Phone: {order.customerPhone || "-"}</div>
              <div>Table: {order.tableNumber || "-"}</div>
            </div>
          ) : null}
        </div>
        <div className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusChipClass(order.status)}`}>
          {order.status}
        </div>
        <div className="text-sm text-white/65">Payment: {order.paymentStatus}</div>
        <div className="font-bold text-orange-300">{formatKsh(order.total)}</div>
        <button
          onClick={onToggleExpanded}
          className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold hover:bg-white/[0.08]"
        >
          {expanded ? "Hide Items" : "View Items"}
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-2">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
            {order.items.map((item) => (
              <div key={`${order.id}-${item.dishId}`} className="mb-2 flex items-center justify-between text-sm last:mb-0">
                <div>{item.quantity} x {item.name}</div>
                <div className="text-orange-300">{formatKsh(item.subtotal)}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {ORDER_STATUS_OPTIONS.map((status) => {
              const active = order.status === status;
              return (
                <button
                  key={`${order.id}-${status}`}
                  onClick={() => onSetStatus(status)}
                  className={`rounded-xl border px-2 py-2 text-xs font-semibold ${
                    active
                      ? "border-emerald-400/35 bg-emerald-500/20 text-emerald-200"
                      : "border-white/10 bg-white/[0.05] text-white/75 hover:bg-white/[0.08]"
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
