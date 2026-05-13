import { BellRing, RefreshCw } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

type NewOrderAlertProps = {
  count: number;
  lastSyncedAt?: string;
  onView: () => void;
  onDismiss: () => void;
  className?: string;
};

function formatSyncTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}

export function NewOrderAlert({
  count,
  lastSyncedAt,
  onView,
  onDismiss,
  className,
}: NewOrderAlertProps) {
  if (count <= 0) return null;
  const syncTime = formatSyncTime(lastSyncedAt);
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-2xl border border-primary/35 bg-primary/12 p-4 shadow-[0_18px_40px_rgba(255,106,26,0.14)]",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-primary/35 bg-primary/16 p-2 text-primary">
            <BellRing className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-black text-text-primary">
              {count === 1 ? "New order received" : `${count} new orders received`}
            </div>
            <div className="mt-1 text-sm text-text-secondary/78">
              The queue refreshed automatically{syncTime ? ` at ${syncTime}` : ""}. No page refresh needed.
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" onClick={onView}>
            <RefreshCw className="h-3.5 w-3.5" />
            View latest
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
