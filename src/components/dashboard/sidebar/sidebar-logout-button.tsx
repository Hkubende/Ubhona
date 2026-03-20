import * as React from "react";
import { LogOut } from "lucide-react";
import { Button } from "../../ui/Button";
import { cn } from "../../../lib/utils";
import { motion } from "../../../design-system";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/Tooltip";

export function SidebarLogoutButton({
  onLogout,
  collapsed = false,
}: {
  onLogout: () => void;
  collapsed?: boolean;
}) {
  const button = (
    <Button
      onClick={onLogout}
      aria-label="Logout"
      className={cn(
        "h-10 w-full rounded-xl border-transparent px-3 text-text-secondary/85 hover:border-border/70 hover:bg-white/[0.06] hover:text-text-primary",
        collapsed ? "justify-center px-0" : "justify-start"
      )}
      variant="ghost"
    >
      <LogOut className="h-4 w-4" />
      <span className={cn(motion.width, collapsed && "w-0 overflow-hidden opacity-0")}>Logout</span>
    </Button>
  );

  if (!collapsed) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">Logout</TooltipContent>
    </Tooltip>
  );
}
