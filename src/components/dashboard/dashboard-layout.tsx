import * as React from "react";
import {
  BarChart3,
  CreditCard,
  LifeBuoy,
  LayoutDashboard,
  Menu,
  Palette,
  Printer,
  Settings,
  ShoppingBag,
  Users2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";
import { logoutUser } from "../../lib/auth";
import { getRestaurantBranding, type RestaurantProfile } from "../../lib/restaurant";
import { canAccessDashboardRoute, getPrimaryDashboardRole } from "../../lib/roles";
import type { DashboardRole } from "../../types/roles";
import { AppShell } from "../layout/AppShell";
import { Button } from "../ui/Button";
import { DashboardContent } from "./layout/dashboard-content";
import { DashboardSidebar } from "./layout/dashboard-sidebar";
import { DashboardTopbar } from "./layout/dashboard-topbar";
import { SidebarBrand } from "./sidebar/sidebar-brand";
import { SidebarLogoutButton } from "./sidebar/sidebar-logout-button";
import { SidebarNavItem } from "./sidebar/sidebar-nav-item";
import { SidebarSection } from "./sidebar/sidebar-section";
import { DashboardSearch } from "./topbar/dashboard-search";
import { NotificationBell } from "./topbar/notification-bell";
import { ProfileMenu } from "./topbar/profile-menu";
import type { NotificationItem } from "../ui/notifications-filter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/Tooltip";
import { motion, tokens, typography } from "../../design-system";


type DashboardNavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group?: "core" | "ops";
};

const CONTROL_CENTER_NAV: DashboardNavItem[] = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, group: "core" },
  { to: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed, group: "core" },
  { to: "/dashboard/orders", label: "Orders", icon: ShoppingBag, group: "core" },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3, group: "core" },
  { to: "/dashboard/branding", label: "Branding", icon: Palette, group: "ops" },
  { to: "/dashboard/staff", label: "Staff", icon: Users2, group: "ops" },
  { to: "/dashboard/printing", label: "Printing", icon: Printer, group: "ops" },
  { to: "/dashboard/payments", label: "Payments", icon: CreditCard, group: "ops" },
  { to: "/dashboard/settings", label: "Settings", icon: Settings, group: "ops" },
];

const ROLE_NAV: Record<DashboardRole, DashboardNavItem[]> = {
  owner: CONTROL_CENTER_NAV,
  admin: CONTROL_CENTER_NAV,
  manager: CONTROL_CENTER_NAV,
  waiter: [
    { to: "/staff", label: "Staff Desk", icon: Users2 },
  ],
  kitchen: [
    { to: "/kitchen", label: "Kitchen Desk", icon: UtensilsCrossed },
  ],
  cashier: [
    { to: "/cashier", label: "Cashier Desk", icon: CreditCard },
  ],
};

type DashboardLayoutProps = {
  profile: RestaurantProfile | null;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  showTopbarSearch?: boolean;
  children: React.ReactNode;
};

function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const currentRole = getPrimaryDashboardRole();
  const roleItems = currentRole ? ROLE_NAV[currentRole] || [] : [];
  const visibleItems = roleItems.filter((item) => canAccessDashboardRoute(item.to, currentRole));
  const coreItems = visibleItems.filter((item) => item.group !== "ops");
  const opsItems = visibleItems.filter((item) => item.group === "ops");

  const activeFor = React.useCallback(
    (to: string) =>
      location.pathname === to ||
      (to === "/dashboard" &&
        (location.pathname === "/dashboard" || location.pathname === "/app" || location.pathname === "/app/")),
    [location.pathname]
  );

  return (
    <div className="space-y-4">
      {coreItems.length ? (
        <SidebarSection title="Core" hideTitle collapsed={collapsed}>
          {coreItems.map((item) => (
            <SidebarNavItem
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              collapsed={collapsed}
              active={activeFor(item.to)}
              onNavigate={onNavigate}
            />
          ))}
        </SidebarSection>
      ) : null}
      {opsItems.length ? (
        <SidebarSection title="Operations" hideTitle collapsed={collapsed}>
          {opsItems.map((item) => (
            <SidebarNavItem
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              collapsed={collapsed}
              active={activeFor(item.to)}
              onNavigate={onNavigate}
            />
          ))}
        </SidebarSection>
      ) : null}
    </div>
  );
}

export function DashboardLayout({
  profile,
  title,
  subtitle,
  actions,
  showTopbarSearch = true,
  children,
}: DashboardLayoutProps) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("ubhona:dashboard-sidebar-collapsed") === "true";
  });
  const branding = getRestaurantBranding(profile);
  const currentRole = getPrimaryDashboardRole();
  const roleItems = currentRole ? ROLE_NAV[currentRole] || [] : [];
  const topbarSearchItems = roleItems
    .filter((item) => canAccessDashboardRoute(item.to, currentRole))
    .map((item) => ({ to: item.to, label: item.label }));

  const topbarNotifications = React.useMemo<NotificationItem[]>(() => {
    const roleLabel =
      currentRole === "owner" || currentRole === "admin" || currentRole === "manager"
        ? "Control Center"
        : currentRole === "waiter"
          ? "Staff Desk"
          : currentRole === "kitchen"
            ? "Kitchen"
            : "Cashier";
    return [
      {
        id: "notif-orders",
        category: "alerts",
        title: "New Orders Waiting",
        description: "Check the Orders queue and update statuses to keep service flowing.",
        time: "now",
      },
      {
        id: "notif-print",
        category: "updates",
        title: "Printer Mode Active",
        description: "Current printer settings are active for this restaurant session.",
        time: "5m ago",
      },
      {
        id: "notif-role",
        category: "reminders",
        title: `You are in ${roleLabel}`,
        description: "Use the left navigation to move between sections quickly.",
        time: "today",
      },
    ];
  }, [currentRole]);

  const onLogout = React.useCallback(() => {
    logoutUser();
    navigate("/login", { replace: true });
  }, [navigate]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("ubhona:dashboard-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <TooltipProvider>
      <AppShell
        sidebar={
          <DashboardSidebar collapsed={sidebarCollapsed}>
            <div className={cn("flex h-full flex-col", tokens.classes.accentRail)}>
              <SidebarBrand collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((current) => !current)} />
              <SidebarNav collapsed={sidebarCollapsed} />
              <div className="mt-auto space-y-2 pt-4">
                <div className="h-px bg-white/10" />
                {sidebarCollapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href="mailto:support@ubhona.com"
                        aria-label="Support"
                        className="flex h-10 w-full items-center justify-center rounded-xl text-sm font-medium text-text-secondary/80 transition-colors hover:bg-white/[0.05] hover:text-text-primary"
                      >
                        <LifeBuoy className="h-4 w-4" />
                        <span className="w-0 overflow-hidden opacity-0">Support</span>
                      </a>
                    </TooltipTrigger>
                    <TooltipContent side="right">Support</TooltipContent>
                  </Tooltip>
                ) : (
                  <a
                    href="mailto:support@ubhona.com"
                    aria-label="Support"
                    className="flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium text-text-secondary/80 transition-colors hover:bg-white/[0.05] hover:text-text-primary"
                  >
                    <LifeBuoy className="h-4 w-4" />
                    <span>Support</span>
                  </a>
                )}
                <SidebarLogoutButton onLogout={onLogout} collapsed={sidebarCollapsed} />
              </div>
            </div>
          </DashboardSidebar>
        }
        topbar={
          <DashboardTopbar>
            <div
              className={cn(
                "grid gap-3 lg:items-center",
                showTopbarSearch ? "lg:grid-cols-[minmax(220px,1fr)_minmax(220px,280px)_auto]" : "lg:grid-cols-[minmax(220px,1fr)_auto]"
              )}
            >
              <div className="flex items-start gap-2">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => setMobileOpen(true)}
                  className="mt-0.5 lg:hidden"
                  aria-label="Open dashboard navigation"
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className={cn("text-2xl tracking-[-0.03em] text-text-primary", typography.pageTitle)}>{title}</h1>
                  {subtitle ? <p className="mt-1 text-sm leading-5 text-text-secondary/76">{subtitle}</p> : null}
                </div>
              </div>
              {showTopbarSearch ? (
                <DashboardSearch items={topbarSearchItems} className="w-full lg:justify-self-end" />
              ) : null}
              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:gap-3 lg:w-auto lg:flex-nowrap">
                {actions ? <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">{actions}</div> : null}
                <NotificationBell items={topbarNotifications} placement="bottom" />
                <ProfileMenu profile={profile} logoUrl={branding.logoUrl} onLogout={onLogout} />
              </div>
            </div>
          </DashboardTopbar>
        }
      >
        <DashboardContent>{children}</DashboardContent>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm lg:hidden">
            <div className={cn(`h-full w-[84%] max-w-80 border-r border-border bg-sidebar p-4 ${motion.width}`, tokens.classes.shellFrame)}>
              <div className="mb-4 flex items-center justify-between">
                <SidebarBrand />
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => setMobileOpen(false)}
                  className="h-9 w-9"
                  aria-label="Close dashboard navigation"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
              <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
                <a
                  href="mailto:support@ubhona.com"
                  className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-text-secondary/80 transition-colors hover:bg-white/[0.05] hover:text-text-primary"
                >
                  <LifeBuoy className="h-4 w-4" />
                  Support
                </a>
              </div>
              <div className="mt-2 flex items-center gap-2 rounded-2xl border border-border bg-white/[0.04] p-2">
                <NotificationBell items={topbarNotifications} placement="right" />
                <SidebarLogoutButton
                  onLogout={() => {
                    setMobileOpen(false);
                    onLogout();
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}
      </AppShell>
    </TooltipProvider>
  );
}
