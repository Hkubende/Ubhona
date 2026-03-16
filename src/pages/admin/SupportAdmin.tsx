import * as React from "react";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAdminSupportRecords, type AdminSupportRecord } from "../../lib/admin";

function badgeClass(priority: string) {
  if (priority === "high") return "border-red-400/35 bg-red-500/20 text-red-200";
  if (priority === "medium") return "border-orange-400/35 bg-orange-500/20 text-orange-200";
  return "border-white/20 bg-white/10 text-white/80";
}

export default function SupportAdmin() {
  const navigate = useNavigate();
  const [records, setRecords] = React.useState<AdminSupportRecord[]>([]);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    getAdminSupportRecords()
      .then((rows) => setRecords(rows))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load support records."));
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl">
          <div>
            <div className="text-2xl font-black">
              <span className="text-orange-400">Support</span> Admin
            </div>
            <div className="text-sm text-white/60">Operational issue signals from platform activity</div>
          </div>
          <button
            onClick={() => navigate("/admin")}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-bold hover:bg-white/[0.08]"
          >
            <ArrowLeft className="h-4 w-4" />
            Admin Home
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-white/70">
            <LifeBuoy className="h-4 w-4" />
            Support Records
          </div>
          <div className="space-y-2">
            {records.map((record) => (
              <div key={record.id} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{record.summary}</div>
                    <div className="text-xs text-white/55">{record.restaurantName} (@{record.restaurantSlug})</div>
                  </div>
                  <div className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(record.priority)}`}>
                    {record.priority}
                  </div>
                </div>
                <div className="mt-2 text-sm text-white/75">{record.details}</div>
                <div className="mt-2 text-xs text-white/50">{new Date(record.createdAt).toLocaleString("en-KE")}</div>
              </div>
            ))}
          </div>
          {!records.length ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-4 text-sm text-white/60">
              No support records right now.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
