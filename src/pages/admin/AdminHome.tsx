import * as React from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CreditCard,
  FolderKanban,
  Headset,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { UbhonaLoader } from "../../components/ui/ubhona-loader";
import { cn } from "../../lib/utils";
import {
  getAdminAuditLogs,
  getAdminBillingOverview,
  getAdminMetrics,
  getAdminRestaurants,
  getAdminSupportRecords,
  type AdminAuditLog,
  type AdminBillingOverviewRow,
  type AdminMetrics,
  type AdminRestaurant,
  type AdminSupportRecord,
} from "../../lib/admin";

type AdminDashboardState = {
  metrics: AdminMetrics;
  restaurants: AdminRestaurant[];
  supportRecords: AdminSupportRecord[];
  billingOverview: AdminBillingOverviewRow[];
  auditLogs: AdminAuditLog[];
};

type AdminSectionCard = {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  meta: string;
};

const ADMIN_SECTIONS: AdminSectionCard[] = [
  {
    title: "Restaurants",
    description: "Inspect tenant health, usage, ownership, and suspension state.",
    href: "/admin/restaurants",
    icon: Building2,
    meta: "Tenant operations",
  },
  {
    title: "Billing",
    description: "Watch renewals, failed payments, outstanding balances, and plan mix.",
    href: "/admin/billing",
    icon: CreditCard,
    meta: "Revenue control",
  },
  {
    title: "Support",
    description: "Prioritize payment failures, suspended accounts, and customer signals.",
    href: "/admin/support",
    icon: Headset,
    meta: "Issue queue",
  },
  {
    title: "Platform Tracker",
    description: "Track delivery work across customer, restaurant, payments, and admin lanes.",
    href: "/platform-tracker",
    icon: FolderKanban,
    meta: "Roadmap board",
  },
];

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

function formatDate(value?: string | null) {
  if (!value) return "n/a";
  return new Date(value).toLocaleDateString("en-KE", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusVariant(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (["active", "paid", "succeeded"].includes(status)) return "success";
  if (["trialing", "pending", "draft"].includes(status)) return "warning";
  if (["past_due", "failed", "suspended", "canceled", "cancelled", "expired"].includes(status)) return "danger";
  return "neutral";
}

function StatTile({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ElementType;
  tone?: "default" | "mint" | "sand" | "risk";
}) {
  const toneClass = {
    default: "text-primary",
    mint: "text-success",
    sand: "text-text-secondary",
    risk: "text-error",
  }[tone];

  return (
    <div className="ui-panel-inset rounded-3xl p-4 transition duration-300 hover:-translate-y-0.5 hover:border-border-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-text-secondary/62">{label}</div>
          <div className={cn("mt-2 text-2xl font-black tracking-[-0.04em]", toneClass)}>{value}</div>
        </div>
        <div className="rounded-2xl border border-border bg-[color:var(--ui-note-icon-bg)] p-2 text-text-secondary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-3 text-sm leading-6 text-text-secondary/74">{detail}</div>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-[color:var(--ui-note-icon-bg)] p-4 text-sm text-text-secondary/72">
      {message}
    </div>
  );
}

export default function AdminHome() {
  const navigate = useNavigate();
  const [data, setData] = React.useState<AdminDashboardState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const loadDashboard = React.useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [metrics, restaurants, supportRecords, billingOverview, auditLogs] = await Promise.all([
        getAdminMetrics(),
        getAdminRestaurants(),
        getAdminSupportRecords(),
        getAdminBillingOverview(),
        getAdminAuditLogs({ limit: 8 }),
      ]);
      setData({ metrics, restaurants, supportRecords, billingOverview, auditLogs });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const metrics = data?.metrics;
  const restaurants = data?.restaurants ?? [];
  const supportRecords = data?.supportRecords ?? [];
  const billingOverview = data?.billingOverview ?? [];
  const auditLogs = data?.auditLogs ?? [];
  const riskCount = restaurants.filter((restaurant) =>
    ["past_due", "suspended", "canceled", "cancelled", "expired"].includes(restaurant.subscriptionStatus)
  ).length;
  const watchlist = billingOverview
    .filter((row) => row.outstandingBalance > 0 || ["past_due", "failed", "suspended"].includes(row.subscriptionStatus))
    .slice(0, 4);
  const topRestaurants = [...restaurants]
    .sort((a, b) => b.usage.revenue - a.usage.revenue || b.usage.orders - a.usage.orders)
    .slice(0, 5);

  return (
    <main className="min-h-screen bg-app-bg text-text-primary">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <section className="ui-surface-elevated overflow-hidden rounded-[30px] p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-success/25 bg-success/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-success">
                <ShieldCheck className="h-4 w-4" />
                Platform Admin
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-text-primary sm:text-5xl">
                Ubhona Control Center
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary/78 sm:text-base">
                A command surface for tenant health, billing risk, support pressure, and platform activity across the Ubhona network.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void loadDashboard()} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button variant="primary" onClick={() => navigate("/admin/restaurants")}>
                Review Restaurants
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-4 rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {loading && !data ? <UbhonaLoader variant="inline" label="Loading admin dashboard" className="mt-5" /> : null}

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Restaurants"
            value={metrics ? String(metrics.restaurants) : "-"}
            detail={`${riskCount} account${riskCount === 1 ? "" : "s"} ${riskCount === 1 ? "needs" : "need"} platform attention`}
            icon={Building2}
          />
          <StatTile
            label="Orders"
            value={metrics ? String(metrics.orders) : "-"}
            detail={`${metrics?.recentOrders24h ?? 0} order${metrics?.recentOrders24h === 1 ? "" : "s"} in the last 24h`}
            icon={Activity}
            tone="sand"
          />
          <StatTile
            label="Revenue"
            value={metrics ? formatKsh(metrics.totalRevenue) : "-"}
            detail="Tracked from restaurant order totals"
            icon={TrendingUp}
            tone="mint"
          />
          <StatTile
            label="Payment Risk"
            value={metrics ? String(metrics.failedPayments) : "-"}
            detail={`${watchlist.length} billing watchlist item${watchlist.length === 1 ? "" : "s"}`}
            icon={AlertTriangle}
            tone="risk"
          />
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <div className="ui-surface rounded-[30px] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-[-0.03em] text-text-primary">Restaurant Network</h2>
                <p className="mt-1 text-sm text-text-secondary/72">Highest-value tenants and the operational shape around them.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin/restaurants")}>
                Open all
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-[0.18em] text-text-secondary/62">
                  <tr>
                    <th className="pb-3 pr-4 font-black">Restaurant</th>
                    <th className="pb-3 pr-4 font-black">Plan</th>
                    <th className="pb-3 pr-4 font-black">Orders</th>
                    <th className="pb-3 pr-4 font-black">Revenue</th>
                    <th className="pb-3 font-black">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {topRestaurants.map((restaurant) => (
                    <tr key={restaurant.id} className="border-b border-border/70 last:border-0">
                      <td className="py-3 pr-4">
                        <div className="font-bold text-text-primary">{restaurant.name}</div>
                        <div className="text-xs text-text-secondary/62">@{restaurant.slug}</div>
                      </td>
                      <td className="py-3 pr-4 text-text-secondary/82">{restaurant.subscriptionPlan}</td>
                      <td className="py-3 pr-4 text-text-secondary/82">{restaurant.usage.orders}</td>
                      <td className="py-3 pr-4 text-text-primary">{formatKsh(restaurant.usage.revenue)}</td>
                      <td className="py-3">
                        <Badge variant={statusVariant(restaurant.subscriptionStatus)}>
                          {restaurant.subscriptionStatus.replace("_", " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!topRestaurants.length ? <EmptyPanel message="No restaurant records are available yet." /> : null}
          </div>

          <aside className="ui-surface rounded-[30px] p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-[-0.03em] text-text-primary">Billing Watchlist</h2>
                <p className="mt-1 text-sm text-text-secondary/72">Accounts requiring payment or subscription follow-up.</p>
              </div>
              <CreditCard className="h-5 w-5 text-text-secondary" />
            </div>
            <div className="space-y-3">
              {watchlist.map((row) => (
                <div key={row.restaurantId} className="ui-panel-inset rounded-2xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-text-primary">{row.restaurantName}</div>
                      <div className="mt-1 text-xs text-text-secondary/65">
                        {row.currentPlan} plan - next date {formatDate(row.trialEndDate)}
                      </div>
                    </div>
                    <Badge variant={statusVariant(row.subscriptionStatus)}>{row.subscriptionStatus.replace("_", " ")}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-text-secondary/68">Outstanding</span>
                    <span className="font-black text-error">{formatKsh(row.outstandingBalance)}</span>
                  </div>
                </div>
              ))}
              {!watchlist.length ? <EmptyPanel message="No billing risk is currently flagged." /> : null}
            </div>
          </aside>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="ui-surface rounded-[30px] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-[-0.03em] text-text-primary">Admin Workspaces</h2>
                <p className="mt-1 text-sm text-text-secondary/72">Fast paths into the platform tools.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {ADMIN_SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.href}
                    type="button"
                    onClick={() => navigate(section.href)}
                    className="ui-panel-inset rounded-3xl p-4 text-left transition duration-300 hover:-translate-y-0.5 hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="rounded-2xl border border-border bg-[color:var(--ui-note-icon-bg)] p-2 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-text-secondary/55" />
                    </div>
                    <div className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-text-secondary/58">{section.meta}</div>
                    <div className="mt-1 text-base font-black text-text-primary">{section.title}</div>
                    <div className="mt-2 text-sm leading-6 text-text-secondary/74">{section.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="ui-surface rounded-[30px] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-[-0.03em] text-text-primary">Support Pressure</h2>
                  <p className="mt-1 text-sm text-text-secondary/72">Open admin-level support signals.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/admin/support")}>
                  Open
                </Button>
              </div>
              <div className="space-y-3">
                {supportRecords.slice(0, 3).map((record) => (
                  <div key={record.id} className="ui-panel-inset rounded-2xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-text-primary">{record.summary}</div>
                        <div className="mt-1 text-xs text-text-secondary/65">{record.restaurantName}</div>
                      </div>
                      <Badge variant={record.priority === "high" ? "danger" : "warning"}>{record.priority}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text-secondary/75">{record.details}</p>
                  </div>
                ))}
                {!supportRecords.length ? <EmptyPanel message="No open support records right now." /> : null}
              </div>
            </div>

            <div className="ui-surface rounded-[30px] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-[-0.03em] text-text-primary">Audit Trail</h2>
                  <p className="mt-1 text-sm text-text-secondary/72">Recent platform-admin actions.</p>
                </div>
                <Activity className="h-5 w-5 text-text-secondary" />
              </div>
              <div className="space-y-3">
                {auditLogs.slice(0, 4).map((log) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-text-primary">{log.action.replaceAll("_", " ")}</div>
                      <div className="text-xs leading-5 text-text-secondary/68">
                        {log.actor.name} - {log.targetType} - {formatDate(log.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
                {!auditLogs.length ? <EmptyPanel message="No audit records are available yet." /> : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
