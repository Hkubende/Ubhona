import * as React from "react";
import { Building2, CreditCard, FolderKanban, Headset, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAdminMetrics, type AdminMetrics } from "../../lib/admin";

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

export default function AdminHome() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = React.useState<AdminMetrics | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    getAdminMetrics()
      .then((data) => setMetrics(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load admin metrics."));
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-3xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            Platform Admin
          </div>
          <div className="mt-2 text-3xl font-black">
            <span className="text-orange-400">Ubhona</span> Control Center
          </div>
          <div className="mt-1 text-sm text-white/60">
            Monitor restaurants, subscriptions, and support.
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs text-white/55">Restaurants</div>
            <div className="mt-2 text-2xl font-black text-orange-300">{metrics?.restaurants ?? "-"}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs text-white/55">Orders</div>
            <div className="mt-2 text-2xl font-black text-emerald-300">{metrics?.orders ?? "-"}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs text-white/55">Revenue</div>
            <div className="mt-2 text-2xl font-black text-cyan-300">
              {metrics ? formatKsh(metrics.totalRevenue) : "-"}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs text-white/55">Failed Payments</div>
            <div className="mt-2 text-2xl font-black text-red-300">{metrics?.failedPayments ?? "-"}</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <button
            onClick={() => navigate("/admin/restaurants")}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-left hover:bg-white/[0.07]"
          >
            <Building2 className="h-6 w-6 text-orange-300" />
            <div className="mt-3 text-lg font-black">Restaurants</div>
            <div className="text-sm text-white/60">Search, filter, suspend/reactivate, and inspect usage.</div>
          </button>
          <button
            onClick={() => navigate("/admin/billing")}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-left hover:bg-white/[0.07]"
          >
            <CreditCard className="h-6 w-6 text-emerald-300" />
            <div className="mt-3 text-lg font-black">Billing</div>
            <div className="text-sm text-white/60">Plan distribution, status mix, and renewal oversight.</div>
          </button>
          <button
            onClick={() => navigate("/admin/support")}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-left hover:bg-white/[0.07]"
          >
            <Headset className="h-6 w-6 text-cyan-300" />
            <div className="mt-3 text-lg font-black">Support</div>
            <div className="text-sm text-white/60">Failed payments and subscription support signals.</div>
          </button>
          <button
            onClick={() => navigate("/platform-tracker")}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-left hover:bg-white/[0.07]"
          >
            <FolderKanban className="h-6 w-6 text-amber-300" />
            <div className="mt-3 text-lg font-black">Platform Tracker</div>
            <div className="text-sm text-white/60">Track roadmap work across customer, dashboard, payments, and admin.</div>
          </button>
        </div>
      </div>
    </div>
  );
}
