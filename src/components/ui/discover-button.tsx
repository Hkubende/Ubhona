import * as React from "react";
import { Flame, Search, Star, X } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

export type DiscoverTab = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
};

type DiscoverButtonProps = {
  tabs?: DiscoverTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  searchPlaceholder?: string;
  idPrefix?: string;
  className?: string;
};

const DEFAULT_TABS: DiscoverTab[] = [
  { id: "core", label: "Core", icon: Flame },
  { id: "ops", label: "Ops", icon: Star },
];

const spring = {
  type: "spring" as const,
  damping: 22,
  stiffness: 240,
  mass: 1.1,
};

export function DiscoverButton({
  tabs = DEFAULT_TABS,
  activeTab,
  onTabChange,
  searchValue,
  onSearchValueChange,
  searchPlaceholder = "Search navigation",
  idPrefix,
  className,
}: DiscoverButtonProps) {
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  const [internalTab, setInternalTab] = React.useState(tabs[0]?.id || "");
  const [internalSearch, setInternalSearch] = React.useState("");
  const autoId = React.useId();
  const resolvedId = idPrefix || autoId.replace(/:/g, "");

  const currentTab = activeTab ?? internalTab;
  const currentSearch = searchValue ?? internalSearch;

  const setTab = (tabId: string) => {
    if (onTabChange) onTabChange(tabId);
    if (activeTab == null) setInternalTab(tabId);
  };

  const setSearch = (value: string) => {
    if (onSearchValueChange) onSearchValueChange(value);
    if (searchValue == null) setInternalSearch(value);
  };

  return (
    <div className={cn("flex h-12 items-center gap-2", className)}>
      <motion.div
        layout
        transition={spring}
        onClick={() => !isSearchExpanded && setIsSearchExpanded(true)}
        className={cn(
          "relative flex h-full cursor-text items-center overflow-hidden rounded-full border border-[#E8D8C3]/35 bg-[#FBF6EE] px-3 shadow-[0_8px_20px_rgba(15,10,8,0.2)]",
          isSearchExpanded ? "flex-1" : "w-12"
        )}
      >
        <Search className="h-4.5 w-4.5 shrink-0 text-[#2B1E17]/70" />
        <motion.div
          initial={false}
          animate={{
            width: isSearchExpanded ? "auto" : "0px",
            opacity: isSearchExpanded ? 1 : 0,
            marginLeft: isSearchExpanded ? "10px" : "0px",
          }}
          transition={spring}
          className="min-w-0 overflow-hidden"
        >
          <input
            id={`${resolvedId}-search`}
            name={`${resolvedId}Search`}
            value={currentSearch}
            onChange={(event) => setSearch(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-sm font-medium text-[#2B1E17] outline-none placeholder:text-[#2B1E17]/45"
          />
        </motion.div>
      </motion.div>

      <motion.div
        layout
        transition={spring}
        className="relative flex h-full items-center overflow-hidden rounded-full border border-[#E8D8C3]/30 bg-[#FBF6EE] p-1 shadow-[0_8px_20px_rgba(15,10,8,0.2)]"
      >
        <motion.div
          initial={false}
          animate={{ width: isSearchExpanded ? 38 : "auto" }}
          transition={spring}
          className="relative flex h-full items-center overflow-hidden"
        >
          <motion.div
            initial={false}
            animate={{ opacity: isSearchExpanded ? 0 : 1 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-1"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTab(tab.id)}
                  className={cn(
                    "relative inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold uppercase tracking-wide transition-colors",
                    active ? "text-[#2B1E17]" : "text-[#2B1E17]/70 hover:text-[#2B1E17]"
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="discover-button-active-bubble"
                      className="absolute inset-0 rounded-full bg-[#E8D8C3]"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                    />
                  ) : null}
                  {Icon ? <Icon className="relative z-10 h-3.5 w-3.5" /> : null}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </motion.div>

          <motion.button
            type="button"
            initial={false}
            animate={{ opacity: isSearchExpanded ? 1 : 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => {
              setIsSearchExpanded(false);
              setSearch("");
            }}
            className={cn(
              "absolute inset-0 inline-flex items-center justify-center text-[#2B1E17]/75",
              !isSearchExpanded && "pointer-events-none"
            )}
            aria-label="Close navigation search"
          >
            <X className="h-4 w-4" />
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default DiscoverButton;
