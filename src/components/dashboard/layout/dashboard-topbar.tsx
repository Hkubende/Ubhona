import * as React from "react";
import { Topbar } from "../../layout/Topbar";

export function DashboardTopbar({ children }: { children: React.ReactNode }) {
  return <Topbar className="p-4 sm:p-5 lg:px-7 lg:py-5">{children}</Topbar>;
}
