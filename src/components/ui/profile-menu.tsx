import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut, Settings, UserCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { RestaurantProfile } from "../../lib/restaurant";
import { cn } from "../../lib/utils";
import { motion } from "../../design-system";

const LOGO_SRC = `${import.meta.env.BASE_URL}ubhona-logo.jpeg`;

type ProfileMenuProps = {
  profile: RestaurantProfile | null;
  logoUrl?: string;
  onLogout: () => void;
  className?: string;
  compact?: boolean;
};

export function ProfileMenu({ profile, logoUrl, onLogout, className, compact = false }: ProfileMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            `inline-flex h-10 items-center gap-2 rounded-full border border-border/80 bg-[linear-gradient(180deg,rgba(255,248,241,0.06),rgba(255,255,255,0.03))] px-2.5 text-left shadow-[inset_0_1px_0_rgba(255,248,241,0.05)] hover:border-primary/25 hover:bg-[linear-gradient(180deg,rgba(255,248,241,0.1),rgba(255,255,255,0.04))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55 ${motion.standard}`,
            className
          )}
          aria-label="Open profile menu"
        >
          <img
            src={logoUrl || profile?.logo || LOGO_SRC}
            alt={profile?.restaurantName || "Restaurant"}
            className="h-7 w-7 rounded-full object-cover"
          />
          {!compact ? (
            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-xs font-semibold text-text-primary">{profile?.restaurantName || "Restaurant"}</div>
              <div className="truncate text-[10px] text-text-secondary/70">@{profile?.slug || "dashboard"}</div>
            </div>
          ) : null}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={10}
          className={cn(
            "z-[80] min-w-52 overflow-hidden rounded-2xl border border-border/80 bg-[linear-gradient(180deg,rgba(38,26,20,0.98),rgba(24,18,15,0.96))] p-1.5 text-text-primary shadow-elevated outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
          )}
        >
          <DropdownMenu.Item asChild>
            <Link
              to="/dashboard/settings"
              className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-white/[0.06] focus:bg-white/[0.06]"
            >
              <UserCircle2 className="h-4 w-4 text-primary" />
              Profile
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link
              to="/dashboard/settings"
              className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-white/[0.06] focus:bg-white/[0.06]"
            >
              <Settings className="h-4 w-4 text-primary" />
              Settings
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-white/8" />
          <DropdownMenu.Item
            onSelect={(event) => {
              event.preventDefault();
              onLogout();
            }}
            className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-300 outline-none transition-colors hover:bg-red-500/12 focus:bg-red-500/12"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default ProfileMenu;
