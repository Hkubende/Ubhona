import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "../../lib/utils";
import { motion } from "../../design-system";

export type UbhonaDropdownItem = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type UbhonaDropdownProps = {
  value?: string;
  onValueChange: (value: string) => void;
  items: UbhonaDropdownItem[];
  placeholder?: string;
  searchable?: boolean;
  emptyText?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  align?: "start" | "center" | "end";
  id?: string;
  name?: string;
  "aria-label"?: string;
};

export function UbhonaDropdown({
  value,
  onValueChange,
  items,
  placeholder = "Select",
  searchable = false,
  emptyText = "No results found.",
  className,
  triggerClassName,
  contentClassName,
  align = "start",
  id,
  name,
  ...props
}: UbhonaDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const selected = items.find((item) => item.value === value);

  const filtered = React.useMemo(() => {
    if (!searchable || !query.trim()) return items;
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => `${item.label} ${item.description || ""}`.toLowerCase().includes(normalized));
  }, [items, query, searchable]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            `inline-flex h-10 w-full items-center justify-between gap-2 rounded-2xl border border-border/80 bg-[linear-gradient(180deg,rgba(255,248,241,0.05),rgba(255,255,255,0.02))] px-3 text-sm font-medium text-text-primary shadow-[inset_0_1px_0_rgba(255,248,241,0.05)] outline-none hover:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/50 ${motion.standard}`,
            triggerClassName,
            className
          )}
          {...props}
        >
          <span className={cn("truncate text-left", !selected && "text-text-secondary/55")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-text-secondary/70" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={8}
          className={cn(
            "z-[80] w-[min(22rem,var(--radix-popover-trigger-width))] rounded-2xl border border-border/80 bg-[linear-gradient(180deg,rgba(38,26,20,0.98),rgba(24,18,15,0.96))] p-2 text-text-primary shadow-elevated outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            contentClassName
          )}
        >
          {searchable ? (
            <label className="mb-2 flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3">
              <Search className="h-4 w-4 text-text-secondary/45" />
              <input
                id={id ? `${id}-search` : undefined}
                name={name ? `${name}-search` : "dropdown-search"}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search..."
                className="h-full w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary/45"
              />
            </label>
          ) : null}
          <div className="max-h-72 overflow-y-auto rounded-xl p-1">
            {filtered.length ? (
              filtered.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    onValueChange(item.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                    "text-text-primary hover:bg-primary/12 focus-visible:bg-primary/12",
                    value === item.value && "bg-primary/16",
                    item.disabled && "cursor-not-allowed opacity-50"
                  )}
                >
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center">
                    {value === item.value ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.label}</span>
                    {item.description ? <span className="block text-xs text-text-secondary/65">{item.description}</span> : null}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-sm text-text-secondary/60">{emptyText}</div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
