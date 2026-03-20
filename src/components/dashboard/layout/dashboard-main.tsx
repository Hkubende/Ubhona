import * as React from "react";

export function DashboardMain({ children }: { children: React.ReactNode }) {
  return <main className="min-w-0 flex-1 space-y-6">{children}</main>;
}

