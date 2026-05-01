import * as React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { tokens } from "../../design-system";
import { getPublicOrderTracking, type PublicOrderTracking } from "../../lib/orders";
import { getSharedStatusLabel, normalizeOrderStatus } from "../../lib/order-status";
import { cn } from "../../lib/utils";
import { UbhonaLoader } from "../../components/ui/ubhona-loader";

const TRACKING_STEPS = [
  { key: "placed", label: "Order Received" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Completed" },
] as const;

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

function getStepIndex(status: string) {
  const normalized = normalizeOrderStatus(status);
  const index = TRACKING_STEPS.findIndex((step) => step.key === normalized);
  return index >= 0 ? index : 0;
}

function getStatusMessage(status: string) {
  const normalized = normalizeOrderStatus(status);
  if (normalized === "placed") return "We have received your order and are notifying the kitchen.";
  if (normalized === "confirmed") return "Your order is confirmed and queued for preparation.";
  if (normalized === "preparing") return "Your meal is being prepared now.";
  if (normalized === "ready") return "Your order is ready for pickup/serving.";
  if (normalized === "completed") return "Order completed. Thank you for dining with us.";
  return "Your order is being processed.";
}

export default function OrderTrackingPage() {
  const { orderId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const trackingToken = searchParams.get("token") || "";
  const [order, setOrder] = React.useState<PublicOrderTracking | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    const fetchOrder = async () => {
      try {
        const next = await getPublicOrderTracking(orderId, trackingToken);
        if (!active) return;
        setOrder(next);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load order.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchOrder();
    const poll = window.setInterval(() => {
      void fetchOrder();
    }, 10000);
    return () => {
      active = false;
      window.clearInterval(poll);
    };
  }, [orderId, trackingToken]);

  if (loading) {
    return <UbhonaLoader fullScreen label="Loading order tracking" shellClassName={tokens.classes.storefrontShell} />;
  }

  if (error || !order) {
    return (
      <div className={cn(tokens.classes.storefrontShell, "min-h-screen p-6")}>
        <div className={cn(tokens.classes.storefrontPanel, "mx-auto max-w-xl p-5 text-center")}>
          <div className="text-lg font-semibold text-primary">Order not found</div>
          <p className="mt-2 text-sm text-text-secondary/80">{error || "Could not find order."}</p>
        </div>
      </div>
    );
  }

  const stepIndex = getStepIndex(order.status);
  const menuUrl = order.restaurant.slug ? `/r/${order.restaurant.slug}/menu` : "/";

  return (
    <div className={cn(tokens.classes.storefrontShell, "min-h-screen")}>
      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 lg:px-8">
        <header className={cn(tokens.classes.storefrontFloating, "mb-4 p-4")}>
          <div className="text-xs uppercase tracking-[0.12em] text-text-secondary/75">{order.restaurant.name}</div>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-text-primary">Order #{order.id}</h1>
          <div className="mt-1 text-sm text-text-secondary/80">Placed {new Date(order.createdAt).toLocaleString("en-KE")}</div>
        </header>

        <section className={cn(tokens.classes.storefrontPanel, "mb-4 p-4 sm:p-5")}>
          <h2 className="text-lg font-semibold text-text-primary">Order Status</h2>
          <div className="mt-3 space-y-2">
            {TRACKING_STEPS.map((step, index) => {
              const completed = index < stepIndex;
              const current = index === stepIndex;
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "h-3.5 w-3.5 rounded-full border",
                      completed
                        ? "border-emerald-300/50 bg-emerald-400"
                        : current
                          ? "border-primary/50 bg-primary"
                          : "ubhona-storefront-step-idle"
                    )}
                  />
                  <div
                    className={cn(
                      "text-sm",
                      completed ? "text-emerald-200" : current ? "font-semibold text-primary" : "text-text-secondary/70"
                    )}
                  >
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="ubhona-storefront-inline-surface mt-4 rounded-xl p-3 text-sm text-text-secondary/84">
            {getStatusMessage(order.status)}
          </div>
          {typeof order.estimatedMinutes === "number" ? (
            <div className="mt-3 text-sm text-text-secondary/82">Estimated time: {order.estimatedMinutes} minutes</div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={normalizeOrderStatus(order.status) === "completed" ? "success" : "accent"} className="uppercase tracking-wide">
              {getSharedStatusLabel(order.status)}
            </Badge>
            <span className="text-xs text-text-secondary/75">Payment: {order.paymentStatus}</span>
          </div>
        </section>

        <section className={cn(tokens.classes.storefrontPanel, "mb-4 p-4 sm:p-5")}>
          <h2 className="text-lg font-semibold text-text-primary">Order Summary</h2>
          <div className="mt-3 space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-text-secondary/85">
                  {item.quantity} x {item.name}
                </span>
                <span className="text-text-primary">{formatKsh(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-border/70 pt-3 text-right text-xl font-semibold text-primary">
            {formatKsh(order.totalAmount)}
          </div>
        </section>

        <div className="grid gap-2 sm:grid-cols-2">
          <a href={order.restaurant.phone ? `tel:${order.restaurant.phone}` : "#"} className={order.restaurant.phone ? "" : "pointer-events-none opacity-50"}>
            <Button variant="secondary" className="w-full">Contact Restaurant</Button>
          </a>
          <Link to={menuUrl}>
            <Button variant="primary" className="w-full">Back to Menu</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
