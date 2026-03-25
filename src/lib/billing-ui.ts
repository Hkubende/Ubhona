export function toTitleCase(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function subscriptionStatusMeta(status: string) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "active") {
    return { label: "Active", hint: "Full access enabled.", className: "border-emerald-400/30 bg-emerald-500/12 text-emerald-100" };
  }
  if (normalized === "trialing") {
    return { label: "Trial", hint: "Trial plan currently active.", className: "border-cyan-400/30 bg-cyan-500/12 text-cyan-100" };
  }
  if (normalized === "past_due") {
    return { label: "Past Due", hint: "Payment needed to keep access uninterrupted.", className: "border-amber-400/30 bg-amber-500/12 text-amber-100" };
  }
  if (normalized === "cancelled") {
    return { label: "Cancelled", hint: "Subscription is cancelled.", className: "border-rose-400/30 bg-rose-500/12 text-rose-100" };
  }
  if (normalized === "expired") {
    return { label: "Expired", hint: "Subscription has expired.", className: "border-rose-400/30 bg-rose-500/12 text-rose-100" };
  }
  return { label: toTitleCase(normalized || "unknown"), hint: "Billing status available.", className: "border-white/15 bg-white/[0.06] text-white/88" };
}

export function paymentStatusMeta(status: string) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "succeeded" || normalized === "paid") {
    return { label: "Paid", hint: "Payment confirmed.", className: "border-emerald-400/30 bg-emerald-500/12 text-emerald-100" };
  }
  if (normalized === "pending" || normalized === "initiated") {
    return { label: "Pending", hint: "Awaiting M-Pesa/customer confirmation.", className: "border-amber-400/30 bg-amber-500/12 text-amber-100" };
  }
  if (normalized === "requires_verification") {
    return { label: "Manual Verification", hint: "Awaiting staff/admin verification.", className: "border-orange-400/30 bg-orange-500/12 text-orange-100" };
  }
  if (normalized === "failed") {
    return { label: "Failed", hint: "Payment attempt failed.", className: "border-rose-400/30 bg-rose-500/12 text-rose-100" };
  }
  if (normalized === "timeout") {
    return { label: "Timed Out", hint: "No confirmation received in time.", className: "border-rose-400/30 bg-rose-500/12 text-rose-100" };
  }
  if (normalized === "cancelled") {
    return { label: "Cancelled", hint: "Payment cancelled by user/provider.", className: "border-rose-400/30 bg-rose-500/12 text-rose-100" };
  }
  return { label: toTitleCase(normalized || "unknown"), hint: "Payment state available.", className: "border-white/15 bg-white/[0.06] text-white/88" };
}

export function invoiceStatusMeta(status: string) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "paid") {
    return { label: "Paid", className: "border-emerald-400/30 bg-emerald-500/12 text-emerald-100" };
  }
  if (normalized === "pending" || normalized === "draft") {
    return { label: "Payment Required", className: "border-amber-400/30 bg-amber-500/12 text-amber-100" };
  }
  if (normalized === "failed") {
    return { label: "Failed", className: "border-rose-400/30 bg-rose-500/12 text-rose-100" };
  }
  if (normalized === "expired") {
    return { label: "Expired", className: "border-rose-400/30 bg-rose-500/12 text-rose-100" };
  }
  if (normalized === "cancelled") {
    return { label: "Cancelled", className: "border-white/20 bg-white/[0.06] text-white/80" };
  }
  return { label: toTitleCase(normalized || "unknown"), className: "border-white/15 bg-white/[0.06] text-white/88" };
}

