import * as React from "react";
import { cn } from "../../lib/utils";
import { tokens } from "../../design-system";

type DataTableProps = {
  children: React.ReactNode;
  className?: string;
};

export function DataTable({ children, className }: DataTableProps) {
  return <div className={cn(`w-full max-w-full overflow-x-auto ${tokens.classes.tableShell}`, className)}>{children}</div>;
}
