import * as React from "react";

export function DashboardContent({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1460px] space-y-7 px-0">{children}</div>;
}
