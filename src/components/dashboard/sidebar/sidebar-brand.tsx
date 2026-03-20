import * as React from "react";
import { Menu, ShieldCheck } from "lucide-react";
import { cn } from "../../../lib/utils";
import { motion } from "../../../design-system";
import { Button } from "../../ui/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/Tooltip";

const LOGO_SRC = `${import.meta.env.BASE_URL}ubhona-logo.jpeg`;

export function SidebarBrand({
  collapsed = false,
  onToggleCollapse,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const toggleButton = (
    <Button
      size="icon"
      variant="ghost"
      onClick={onToggleCollapse}
      className="h-9 w-9 shrink-0 rounded-xl border border-white/10 bg-white/[0.04] text-text-secondary hover:bg-white/[0.08] hover:text-text-primary"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      <Menu className="h-4 w-4" />
    </Button>
  );

  return (
    <div className={cn("mb-6 flex items-center px-2", collapsed ? "justify-center gap-2" : "gap-3")}>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{toggleButton}</TooltipTrigger>
          <TooltipContent side="right">Expand sidebar</TooltipContent>
        </Tooltip>
      ) : (
        toggleButton
      )}
      <img src={LOGO_SRC} alt="Ubhona" className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-white/10" />
      <div className={cn(`min-w-0 ${motion.width}`, collapsed && "pointer-events-none w-0 overflow-hidden opacity-0")}>
        <div className="text-base font-semibold tracking-[-0.03em]">
          <span className="text-primary">Ubhona</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-text-secondary/62">
          <ShieldCheck className="h-3 w-3 text-text-secondary/65" />
          Visualize operations
        </div>
      </div>
    </div>
  );
}
