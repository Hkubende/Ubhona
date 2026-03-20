import * as React from "react";

export function DashboardContent({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1440px] space-y-6 px-2 lg:px-0">{children}</div>;
}
