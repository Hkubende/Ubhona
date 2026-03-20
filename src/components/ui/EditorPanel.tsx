import * as React from "react";
import { cn } from "../../lib/utils";
import { tokens } from "../../design-system";

export function EditorPanel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn(tokens.classes.panel, className)} {...props}>
      {children}
    </section>
  );
}
