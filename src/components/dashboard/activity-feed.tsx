import * as React from "react";
import { Clock3 } from "lucide-react";
import { DashboardPanel, SectionHeader } from "./dashboard-primitives";
import { cn } from "../../lib/utils";
import { tokens } from "../../design-system";
import type { ActivityItem } from "../../lib/activity";

function formatTime(value: string) {
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return value;
  return time.toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ActivityFeed({
  title,
  subtitle,
  items,
  loading,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  items: ActivityItem[];
  loading?: boolean;
  emptyMessage?: string;
}) {
  return (
    <DashboardPanel className="space-y-3">
      <SectionHeader title={title} subtitle={subtitle} />
      {loading ? (
        <div className="space-y-2">
          <div className="h-3 w-52 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-72 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-60 animate-pulse rounded bg-white/10" />
        </div>
      ) : null}
      {!loading && !items.length ? (
        <div className={cn(tokens.classes.panelInset, "px-3 py-2 text-sm text-text-secondary/72")}>
          {emptyMessage || "No activity recorded yet."}
        </div>
      ) : null}
      {!loading && items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className={cn(tokens.classes.panelInset, "space-y-1.5 px-3 py-2.5")}>
              <p className="text-sm leading-snug text-text-primary">{item.message}</p>
              <div className="flex items-center gap-2 text-xs text-text-secondary/70">
                <Clock3 className="h-3.5 w-3.5" />
                <span>{formatTime(item.timestamp)}</span>
                <span className="rounded-full border border-white/10 px-2 py-0.5 uppercase tracking-[0.08em]">
                  {item.action.replaceAll("_", " ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </DashboardPanel>
  );
}

