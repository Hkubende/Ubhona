import * as React from "react";
import { Check, Circle } from "lucide-react";
import { DashboardPanel, EmptyStateCard, SectionHeader } from "./dashboard-primitives";
import { cn } from "../../lib/utils";

type TimelineState = "completed" | "current" | "upcoming";

export type TimelineItem = {
  id: string;
  label: string;
  detail: string;
  state: TimelineState;
};

function markerClasses(state: TimelineState) {
  if (state === "completed") return "ui-status-success";
  if (state === "current") return "ui-status-accent";
  return "ui-status-neutral";
}

function railClasses(state: TimelineState) {
  if (state === "completed") return "ui-status-fill-success";
  if (state === "current") return "ui-status-fill-accent";
  return "ui-status-fill-neutral";
}

export function OrderLifecycleTimeline({
  orderLabel,
  items,
}: {
  orderLabel?: string;
  items: TimelineItem[] | null;
}) {
  if (!items) {
    return (
      <DashboardPanel>
        <SectionHeader
          title="Order lifecycle"
          subtitle="Track the selected order through payment, kitchen, and completion states."
        />
        <div className="mt-4">
          <EmptyStateCard
            message="Select an order to view its lifecycle."
            description="The timeline appears here when an order is selected."
          />
        </div>
      </DashboardPanel>
    );
  }

  return (
    <DashboardPanel className="space-y-4">
      <SectionHeader
        title="Order lifecycle"
        subtitle={orderLabel ? `Lifecycle for ${orderLabel}.` : "Track the selected order through service."}
      />
      <div className="space-y-3">
        {items.map((item, index) => {
          const Icon = item.state === "completed" ? Check : Circle;
          const showRail = index < items.length - 1;
          return (
            <div key={item.id} className="flex gap-3">
              <div className="flex w-8 shrink-0 flex-col items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border shadow-[inset_0_1px_0_color-mix(in_srgb,var(--color-surface)_86%,white_14%)]",
                    markerClasses(item.state)
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {showRail ? <div className={cn("mt-2 h-full w-px min-h-8", railClasses(item.state))} /> : null}
              </div>
              <div className="min-w-0 flex-1 rounded-[20px] border border-border bg-[color:var(--ui-note-icon-bg)] px-4 py-3">
                <div className="text-sm font-semibold text-text-primary">{item.label}</div>
                <div className="mt-1 text-sm leading-6 text-text-secondary/82">{item.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardPanel>
  );
}
