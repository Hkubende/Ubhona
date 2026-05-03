import * as React from "react";
import { Topbar } from "../../layout/Topbar";

export function DashboardTopbar({ children }: { children: React.ReactNode }) {
  return (
    <Topbar retractOnScroll>
      {children}
    </Topbar>
  );
}
