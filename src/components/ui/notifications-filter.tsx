import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { AlertCircle, Bell, Calendar, Filter, Info } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { cn } from "../../lib/utils";
import { motion } from "../../design-system";

export type NotificationCategory = "updates" | "alerts" | "reminders";

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  icon?: React.ReactNode;
  title: string;
  description: string;
  time: string;
  read?: boolean;
}

interface NotificationsFilterProps {
  items?: NotificationItem[];
  placement?: "top" | "bottom" | "left" | "right";
  className?: string;
}

const defaultNotifications: NotificationItem[] = [
  {
    id: "1",
    category: "updates",
    icon: <Info className="h-4 w-4" />,
    title: "Menu Sync Complete",
    description: "Your latest dish updates are now live on the storefront.",
    time: "just now",
  },
  {
    id: "2",
    category: "alerts",
    icon: <AlertCircle className="h-4 w-4" />,
    title: "Pending Orders Aging",
    description: "2 orders have been pending for more than 10 minutes.",
    time: "14m ago",
  },
  {
    id: "3",
    category: "reminders",
    icon: <Calendar className="h-4 w-4" />,
    title: "Shift Handover",
    description: "Kitchen and cashier handover starts at 4:00 PM.",
    time: "1h ago",
  },
];

const categories: Array<{ key: "all" | NotificationCategory; label: string }> = [
  { key: "all", label: "All" },
  { key: "updates", label: "Updates" },
  { key: "alerts", label: "Alerts" },
  { key: "reminders", label: "Reminders" },
];

export function NotificationsFilter({
  items = defaultNotifications,
  placement = "bottom",
  className,
}: NotificationsFilterProps) {
  const [selected, setSelected] = React.useState<"all" | NotificationCategory>("all");
  const [open, setOpen] = React.useState(false);
  const [dismissedIds, setDismissedIds] = React.useState<string[]>([]);

  const visibleItems = React.useMemo(
    () => items.filter((item) => !dismissedIds.includes(item.id)),
    [items, dismissedIds]
  );
  const unreadCount = React.useMemo(
    () => visibleItems.filter((item) => !item.read).length,
    [visibleItems]
  );
  const filteredItems = React.useMemo(
    () => (selected === "all" ? visibleItems : visibleItems.filter((item) => item.category === selected)),
    [selected, visibleItems]
  );

  const dismissAll = () => {
    setDismissedIds((prev) => [...new Set([...prev, ...visibleItems.map((item) => item.id)])]);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Open notifications"
          className={cn(
            `relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/80 bg-[linear-gradient(180deg,rgba(255,248,241,0.06),rgba(255,255,255,0.03))] text-text-primary shadow-[inset_0_1px_0_rgba(255,248,241,0.05)] hover:border-primary/25 hover:bg-[linear-gradient(180deg,rgba(255,248,241,0.1),rgba(255,255,255,0.04))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55 ${motion.standard}`,
            className
          )}
        >
          <Bell className="h-4.5 w-4.5" />
          {unreadCount > 0 ? (
            <Badge
              variant="accent"
              className="absolute -right-1 -top-1 min-w-5 justify-center px-1.5 py-0 text-[10px] leading-4"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          ) : null}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side={placement}
          align="end"
          sideOffset={10}
          className={cn(
            "z-[80] w-[min(92vw,24rem)] overflow-hidden rounded-2xl border border-border/80 bg-[linear-gradient(180deg,rgba(38,26,20,0.98),rgba(24,18,15,0.96))] text-text-primary shadow-elevated",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
          )}
        >
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Filter className="h-4 w-4 text-primary" />
              Notifications
            </h2>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-lg px-2 text-text-secondary/70 hover:bg-white/[0.06] hover:text-text-primary"
              onClick={dismissAll}
              disabled={!visibleItems.length}
            >
              Clear all
            </Button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto border-b border-white/8 px-3 py-2">
            {categories.map((cat) => (
              <Button
                key={cat.key}
                size="sm"
                variant={selected === cat.key ? "secondary" : "ghost"}
                onClick={() => setSelected(cat.key)}
                className={cn(
                  "h-8 rounded-full px-3 text-xs",
                  selected === cat.key
                    ? "border-primary/40 bg-primary/15 text-text-primary"
                    : "border-transparent text-text-secondary/70 hover:bg-white/[0.06] hover:text-text-primary"
                )}
              >
                {cat.label}
              </Button>
            ))}
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-5 text-center text-sm text-text-secondary/60">No notifications in this category.</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="border-b border-white/8 px-4 py-3 transition-colors hover:bg-white/[0.06]"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-primary">{item.icon || <Info className="h-4 w-4" />}</span>
                      <span className="truncate text-sm font-semibold">{item.title}</span>
                    </div>
                    <span className="shrink-0 text-[11px] text-text-secondary/55">{item.time}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-text-secondary/70">{item.description}</p>
                </div>
              ))}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default NotificationsFilter;
