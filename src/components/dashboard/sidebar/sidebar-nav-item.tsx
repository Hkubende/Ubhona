import * as React from "react";
import { Link } from "react-router-dom";
import { cn } from "../../../lib/utils";
import { motion } from "../../../design-system";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/Tooltip";

type SidebarNavItemProps = {
  to: string;
  label: string;
  active?: boolean;
  onNavigate?: () => void;
  collapsed?: boolean;
  icon: React.ComponentType<{ className?: string }>;
};

export function SidebarNavItem({ to, label, active, onNavigate, collapsed, icon: Icon }: SidebarNavItemProps) {
  const link = (
    <Link
      to={to}
      onClick={onNavigate}
      aria-label={label}
      className={cn(
        `group relative flex w-full items-center rounded-xl px-3 py-2 text-sm ${motion.standard}`,
        collapsed ? "justify-center gap-0 px-0 py-2.5" : "gap-3",
        active
          ? "bg-[linear-gradient(180deg,rgba(255,106,26,0.2),rgba(120,47,17,0.11))] text-primary shadow-[inset_0_0_0_1px_rgba(255,106,26,0.24),0_0_14px_rgba(255,106,26,0.12),0_8px_16px_rgba(60,24,12,0.16)]"
          : "text-text-secondary/78 hover:bg-white/[0.06] hover:text-text-primary"
      )}
    >
      <span
        className={cn(
          "absolute inset-y-2 left-0 w-0.5 rounded-full transition-colors",
          active ? "bg-[linear-gradient(180deg,rgba(255,127,51,0.4),rgba(255,106,26,0.98))]" : "bg-transparent group-hover:bg-primary/40"
        )}
      />
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
          active
            ? "bg-primary/15 text-primary"
            : "text-text-secondary/70 group-hover:bg-white/[0.06] group-hover:text-text-primary"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span
        className={cn(
          "font-medium transition-all duration-200",
          active ? "text-primary" : "text-inherit",
          collapsed && "w-0 overflow-hidden opacity-0"
        )}
      >
        {label}
      </span>
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
