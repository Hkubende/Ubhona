import * as React from "react";
import { TopbarSearch } from "../topbar-search";

type DashboardSearchProps = {
  items: Array<{ to: string; label: string }>;
  className?: string;
};

export function DashboardSearch({ items, className }: DashboardSearchProps) {
  return <TopbarSearch items={items} className={className} />;
}

