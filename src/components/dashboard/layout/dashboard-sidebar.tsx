import * as React from "react";
import { Sidebar } from "../../layout/Sidebar";
import { cn } from "../../../lib/utils";
import { motion } from "../../../design-system";

export function DashboardSidebar({
  children,
  collapsed = false,
}: {
  children: React.ReactNode;
  collapsed?: boolean;
}) {
  return (
    <Sidebar
      className={cn(
        collapsed ? "lg:w-[82px] lg:px-2.5" : "lg:w-[294px] lg:px-3.5",
        `overflow-hidden ${motion.width}`
      )}
    >
      {children}
    </Sidebar>
  );
}
