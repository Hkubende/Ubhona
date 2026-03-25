import * as React from "react";
import { Check, X } from "lucide-react";
import { DashboardPanel, SectionHeader } from "./dashboard-primitives";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { tokens } from "../../design-system";
import type { ApprovalItem } from "../../lib/activity";

function statusClass(status: ApprovalItem["status"]) {
  if (status === "approved") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
  if (status === "rejected") return "border-red-400/30 bg-red-500/10 text-red-100";
  return "border-[#FF6A1A]/35 bg-[#FF6A1A]/10 text-[#F7F1E8]";
}

export function ApprovalQueue({
  items,
  loading,
  reviewingId,
  canReview,
  onReview,
}: {
  items: ApprovalItem[];
  loading?: boolean;
  reviewingId?: string | null;
  canReview?: boolean;
  onReview: (approvalId: string, decision: "approved" | "rejected") => void;
}) {
  return (
    <DashboardPanel className="space-y-3">
      <SectionHeader title="Approval Queue" subtitle="Sensitive operational changes pending review." />
      {loading ? (
        <div className="space-y-2">
          <div className="h-3 w-52 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-72 animate-pulse rounded bg-white/10" />
        </div>
      ) : null}
      {!loading && !items.length ? (
        <div className={cn(tokens.classes.panelInset, "px-3 py-2 text-sm text-text-secondary/72")}>
          No pending approvals.
        </div>
      ) : null}
      {!loading && items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className={cn(tokens.classes.panelInset, "space-y-2 px-3 py-2.5")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-text-primary">
                  {item.actionType.replaceAll("_", " ")}
                </div>
                <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase", statusClass(item.status))}>
                  {item.status}
                </span>
              </div>
              <p className="text-xs text-text-secondary/72">
                Entity: {item.entityType} {item.entityId}
              </p>
              {item.reason ? <p className="text-xs text-text-secondary/78">{item.reason}</p> : null}
              {item.status === "pending" && canReview ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => onReview(item.id, "approved")}
                    disabled={reviewingId === item.id}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onReview(item.id, "rejected")}
                    disabled={reviewingId === item.id}
                  >
                    <X className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </DashboardPanel>
  );
}

