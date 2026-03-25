import * as React from "react";

export function SidebarSection({
  title,
  hideTitle = false,
  collapsed = false,
  children,
}: {
  title: string;
  hideTitle?: boolean;
  collapsed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className={collapsed ? "space-y-1.5" : "space-y-1"}>
      {hideTitle ? <span className="sr-only">{title}</span> : null}
      <div className={collapsed ? "grid gap-1" : "grid gap-0.5"}>{children}</div>
    </section>
  );
}
