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
        collapsed ? "lg:w-24 lg:px-3" : "lg:w-72 lg:px-4",
        `overflow-hidden ${motion.width}`
      )}
    >
      {children}
    </Sidebar>
  );
}
