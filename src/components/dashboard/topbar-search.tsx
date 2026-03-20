import * as React from "react";
import { Search } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";

type TopbarSearchItem = {
  to: string;
  label: string;
};

type TopbarSearchProps = {
  items: TopbarSearchItem[];
  className?: string;
};

export function TopbarSearch({ items, className }: TopbarSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const [focused, setFocused] = React.useState(false);

  const normalized = query.trim().toLowerCase();
  const results = React.useMemo(() => {
    if (!normalized) return items.slice(0, 5);
    return items.filter((item) => item.label.toLowerCase().includes(normalized)).slice(0, 6);
  }, [items, normalized]);

  const open = focused && (normalized.length > 0 || results.length > 0);

  return (
    <div className={cn("relative", className)}>
      <label className="flex h-10 items-center gap-2 rounded-full border border-border/70 bg-white/[0.02] px-3 transition-colors focus-within:border-primary/40 focus-within:bg-white/[0.06]">
        <Search className="h-4 w-4 text-text-secondary/70" />
        <input
          id="dashboard-topbar-search"
          name="dashboardTopbarSearch"
          aria-label="Search dashboard pages and sections"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results[0]) {
              event.preventDefault();
              navigate(results[0].to);
            }
          }}
          placeholder="Search orders, dishes..."
          className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary/45"
        />
        <span aria-hidden="true" className="hidden rounded-lg border border-border/70 bg-black/20 px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary/65 sm:inline-flex">
          Enter
        </span>
      </label>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-xl border border-border bg-[linear-gradient(180deg,rgba(36,26,20,0.98),rgba(22,16,12,0.96))] shadow-elevated">
          {results.length ? (
            <div className="max-h-72 overflow-y-auto p-1.5">
              {results.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary"
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-text-secondary/55">Open</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-3 py-3 text-sm text-text-secondary/70">No matching sections.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default TopbarSearch;
