import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../../lib/utils";

export type UbhonaActionMenuItem = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

type UbhonaActionMenuProps = {
  label?: string;
  items: UbhonaActionMenuItem[];
  className?: string;
  align?: "start" | "center" | "end";
};

export function UbhonaActionMenu({
  label = "Open actions menu",
  items,
  className,
  align = "end",
}: UbhonaActionMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          className={cn("h-9 w-9 rounded-xl border border-border bg-black/20 text-text-secondary hover:bg-white/[0.08] hover:text-text-primary", className)}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={8}
          className={cn(
            "z-[80] min-w-44 rounded-2xl border border-border/80 bg-[linear-gradient(180deg,rgba(38,26,20,0.98),rgba(24,18,15,0.96))] p-1.5 text-text-primary shadow-elevated outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
          )}
        >
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.key}
              disabled={item.disabled}
              onSelect={(event) => {
                event.preventDefault();
                item.onSelect();
              }}
              className={cn(
                "flex cursor-pointer select-none items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium outline-none transition-colors",
                "hover:bg-white/[0.07] focus:bg-primary/14 data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
                item.destructive ? "text-red-300 focus:bg-red-500/12" : "text-text-primary"
              )}
            >
              {item.icon ? <span className="inline-flex h-4 w-4 items-center justify-center">{item.icon}</span> : null}
              <span>{item.label}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
