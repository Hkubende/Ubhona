import * as React from "react";
import { ArrowLeft, FolderKanban, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getPlatformTrackerProgress,
  getDefaultPlatformTracker,
  loadPlatformTracker,
  resetPlatformTracker,
  savePlatformTracker,
  updatePlatformTrackerItem,
  type PlatformTrackerBoard,
  type PlatformTrackerStatus,
} from "../../lib/platform-tracker";

const STATUS_OPTIONS: Array<{ value: PlatformTrackerStatus; label: string }> = [
  { value: "backlog", label: "Backlog" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
];

function statusClasses(status: PlatformTrackerStatus) {
  if (status === "done") return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
  if (status === "in_progress") return "border-cyan-400/30 bg-cyan-500/15 text-cyan-200";
  if (status === "planned") return "border-amber-400/30 bg-amber-500/15 text-amber-200";
  if (status === "blocked") return "border-rose-400/30 bg-rose-500/15 text-rose-200";
  return "border-white/10 bg-white/[0.04] text-white/70";
}

export default function PlatformTracker() {
  const navigate = useNavigate();
  const [board, setBoard] = React.useState<PlatformTrackerBoard>(() => getDefaultPlatformTracker());
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");

  React.useEffect(() => {
    let active = true;
    loadPlatformTracker()
      .then((next) => {
        if (!active) return;
        setBoard(next);
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load tracker.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (loading) return;
    const timer = window.setTimeout(() => {
      void savePlatformTracker(board)
        .then(() => {
          setError("");
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to save tracker.");
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [board, loading]);

  const setItemStatus = (sectionId: string, itemId: string, status: PlatformTrackerStatus) => {
    setBoard((current) => updatePlatformTrackerItem(current, sectionId, itemId, { status }));
    setNotice("Tracker updated.");
  };

  const setItemNotes = (sectionId: string, itemId: string, notes: string) => {
    setBoard((current) => updatePlatformTrackerItem(current, sectionId, itemId, { notes }));
  };

  const resetBoard = () => {
    void resetPlatformTracker()
      .then((next) => {
        setBoard(next);
        setNotice("Tracker reset to roadmap defaults.");
        setError("");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to reset tracker.");
      });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.12),_transparent_28%),#06080d] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-[28px] border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-3 text-cyan-200">
                <FolderKanban className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300/80">
                  Internal Platform Tracker
                </div>
                <div className="mt-1 text-3xl font-black text-white">
                  Ubhona Platform Roadmap
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  Separate from the storefront UI. This is our working browser-based delivery board.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/admin")}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white hover:bg-white/[0.08]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Admin
              </button>
              <button
                onClick={resetBoard}
                className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-200 hover:bg-amber-500/20"
              >
                <RefreshCw className="h-4 w-4" />
                Reset Board
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mb-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            {notice}
          </div>
        ) : null}

        {loading ? (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
            Loading shared tracker...
          </div>
        ) : null}

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          {board.sections.map((section) => (
            <div key={section.id} className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Progress</div>
              <div className="mt-2 text-lg font-black text-white">{section.title}</div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-amber-300"
                  style={{ width: `${getPlatformTrackerProgress(section)}%` }}
                />
              </div>
              <div className="mt-2 text-sm text-slate-300">{getPlatformTrackerProgress(section)}% complete</div>
            </div>
          ))}
        </div>

        <div className="space-y-5">
          {board.sections.map((section) => (
            <section key={section.id} className="rounded-[30px] border border-white/10 bg-slate-950/55 p-5 backdrop-blur-xl">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
                    Roadmap Track
                  </div>
                  <h2 className="mt-1 text-2xl font-black text-white">{section.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{section.description}</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-bold text-slate-300">
                  {section.items.length} items
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {section.items.map((item) => (
                  <div key={item.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-lg font-bold text-white">{item.label}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Updated {new Date(item.updatedAt).toLocaleString("en-GB")}
                        </div>
                      </div>
                      <div className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(item.status)}`}>
                        {item.status.replace("_", " ")}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map((statusOption) => (
                        <button
                          key={`${item.id}-${statusOption.value}`}
                          onClick={() => setItemStatus(section.id, item.id, statusOption.value)}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                            item.status === statusOption.value
                              ? statusClasses(statusOption.value)
                              : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
                          }`}
                        >
                          {statusOption.label}
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={item.notes}
                      onChange={(event) => setItemNotes(section.id, item.id, event.target.value)}
                      placeholder="Add implementation notes, blockers, decisions, or next steps..."
                      rows={4}
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
