import { getCurrentUser, type AuthUser } from "./auth";
import type { DashboardAction, DashboardPermission, DashboardRole, RoleDefinition } from "../types/roles";

const DEV_ROLE_OVERRIDE_KEY = "ubhona:dev:role-override";
const ROLE_VALUES: DashboardRole[] = ["owner", "admin", "manager", "waiter", "kitchen", "cashier"];

const ROLE_CONFIG: Record<DashboardRole, RoleDefinition> = {
  owner: {
    id: "owner",
    label: "Owner",
    defaultRoute: "/dashboard",
    permissions: {
      viewOverview: true,
      manageMenu: true,
      viewOrders: true,
      updateOrderStatus: true,
      createOrders: true,
      viewAnalytics: true,
      manageBranding: true,
      manageSettings: true,
      printKitchenTicket: true,
      printCustomerReceipt: true,
      printPaymentReceipt: true,
      manageStaff: true,
      managePrinting: true,
      managePayments: true,
      manageBilling: true,
      accessStaffDesk: true,
      accessKitchenDesk: true,
      accessCashierDesk: true,
    },
    actions: {
      manage_menu: true,
      manage_stock: true,
      edit_price: true,
      create_order: true,
      update_kitchen_status: true,
      update_service_order_status: true,
      manage_staff: true,
      manage_branding: true,
      manage_billing: true,
      manage_settings: true,
      print_ticket: true,
    },
  },
  admin: {
    id: "admin",
    label: "Admin",
    defaultRoute: "/dashboard",
    permissions: {
      viewOverview: true,
      manageMenu: true,
      viewOrders: true,
      updateOrderStatus: true,
      createOrders: true,
      viewAnalytics: true,
      manageBranding: true,
      manageSettings: true,
      printKitchenTicket: true,
      printCustomerReceipt: true,
      printPaymentReceipt: true,
      manageStaff: true,
      managePrinting: true,
      managePayments: true,
      manageBilling: true,
      accessStaffDesk: true,
      accessKitchenDesk: true,
      accessCashierDesk: true,
    },
    actions: {
      manage_menu: true,
      manage_stock: true,
      edit_price: true,
      create_order: true,
      update_kitchen_status: true,
      update_service_order_status: true,
      manage_staff: true,
      manage_branding: true,
      manage_billing: true,
      manage_settings: true,
      print_ticket: true,
    },
  },
  manager: {
    id: "manager",
    label: "Manager",
    defaultRoute: "/dashboard",
    permissions: {
      viewOverview: true,
      manageMenu: true,
      viewOrders: true,
      updateOrderStatus: true,
      createOrders: true,
      viewAnalytics: true,
      manageBranding: false,
      manageSettings: true,
      printKitchenTicket: true,
      printCustomerReceipt: true,
      printPaymentReceipt: true,
      manageStaff: true,
      managePrinting: true,
      managePayments: false,
      manageBilling: false,
      accessStaffDesk: true,
      accessKitchenDesk: true,
      accessCashierDesk: true,
    },
    actions: {
      manage_menu: true,
      manage_stock: true,
      edit_price: true,
      create_order: true,
      update_kitchen_status: true,
      update_service_order_status: true,
      manage_staff: true,
      manage_branding: false,
      manage_billing: false,
      manage_settings: true,
      print_ticket: true,
    },
  },
  waiter: {
    id: "waiter",
    label: "Waiter",
    defaultRoute: "/dashboard/staff-orders",
    permissions: {
      viewOverview: false,
      manageMenu: false,
      viewOrders: true,
      updateOrderStatus: true,
      createOrders: true,
      viewAnalytics: false,
      manageBranding: false,
      manageSettings: false,
      printKitchenTicket: false,
      printCustomerReceipt: true,
      printPaymentReceipt: false,
      manageStaff: false,
      managePrinting: false,
      managePayments: false,
      manageBilling: false,
      accessStaffDesk: true,
      accessKitchenDesk: false,
      accessCashierDesk: false,
    },
    actions: {
      manage_menu: false,
      manage_stock: false,
      edit_price: false,
      create_order: true,
      update_kitchen_status: false,
      update_service_order_status: true,
      manage_staff: false,
      manage_branding: false,
      manage_billing: false,
      manage_settings: false,
      print_ticket: true,
    },
  },
  kitchen: {
    id: "kitchen",
    label: "Kitchen",
    defaultRoute: "/dashboard/kitchen",
    permissions: {
      viewOverview: false,
      manageMenu: false,
      viewOrders: true,
      updateOrderStatus: true,
      createOrders: false,
      viewAnalytics: false,
      manageBranding: false,
      manageSettings: false,
      printKitchenTicket: true,
      printCustomerReceipt: false,
      printPaymentReceipt: false,
      manageStaff: false,
      managePrinting: false,
      managePayments: false,
      manageBilling: false,
      accessStaffDesk: false,
      accessKitchenDesk: true,
      accessCashierDesk: false,
    },
    actions: {
      manage_menu: false,
      manage_stock: false,
      edit_price: false,
      create_order: false,
      update_kitchen_status: true,
      update_service_order_status: false,
      manage_staff: false,
      manage_branding: false,
      manage_billing: false,
      manage_settings: false,
      print_ticket: true,
    },
  },
  cashier: {
    id: "cashier",
    label: "Cashier",
    defaultRoute: "/cashier",
    permissions: {
      viewOverview: false,
      manageMenu: false,
      viewOrders: true,
      updateOrderStatus: true,
      createOrders: false,
      viewAnalytics: false,
      manageBranding: false,
      manageSettings: false,
      printKitchenTicket: false,
      printCustomerReceipt: false,
      printPaymentReceipt: true,
      manageStaff: false,
      managePrinting: false,
      managePayments: false,
      manageBilling: false,
      accessStaffDesk: false,
      accessKitchenDesk: false,
      accessCashierDesk: true,
    },
    actions: {
      manage_menu: false,
      manage_stock: false,
      edit_price: false,
      create_order: false,
      update_kitchen_status: false,
      update_service_order_status: true,
      manage_staff: false,
      manage_branding: false,
      manage_billing: false,
      manage_settings: false,
      print_ticket: true,
    },
  },
};

const ROLE_PRIORITY: DashboardRole[] = ["owner", "admin", "manager", "waiter", "kitchen", "cashier"];

const ROUTE_PERMISSION_MAP: Array<{ match: RegExp; permission: DashboardPermission }> = [
  { match: /^\/dashboard\/?$/i, permission: "viewOverview" },
  { match: /^\/dashboard\/menu\/?$/i, permission: "manageMenu" },
  { match: /^\/dashboard\/orders\/?$/i, permission: "viewOrders" },
  { match: /^\/dashboard\/kitchen\/?$/i, permission: "accessKitchenDesk" },
  { match: /^\/dashboard\/staff-orders\/?$/i, permission: "viewOrders" },
  { match: /^\/dashboard\/analytics\/?$/i, permission: "viewAnalytics" },
  { match: /^\/dashboard\/branding\/?$/i, permission: "manageBranding" },
  { match: /^\/dashboard\/settings\/?$/i, permission: "manageSettings" },
  { match: /^\/dashboard\/staff\/?$/i, permission: "manageStaff" },
  { match: /^\/dashboard\/printing\/?$/i, permission: "managePrinting" },
  { match: /^\/dashboard\/payments\/?$/i, permission: "managePayments" },
  { match: /^\/dashboard\/inventory\/?$/i, permission: "manageMenu" },
  { match: /^\/dashboard\/floor\/?$/i, permission: "viewOrders" },
  { match: /^\/dashboard\/billing\/?$/i, permission: "manageBilling" },
  { match: /^\/app\/menu\/?$/i, permission: "manageMenu" },
  { match: /^\/app\/orders\/?$/i, permission: "viewOrders" },
  { match: /^\/app\/kitchen\/?$/i, permission: "accessKitchenDesk" },
  { match: /^\/app\/staff-orders\/?$/i, permission: "viewOrders" },
  { match: /^\/dashboard\/orders\/new\/?$/i, permission: "createOrders" },
  { match: /^\/app\/analytics\/?$/i, permission: "viewAnalytics" },
  { match: /^\/app\/branding\/?$/i, permission: "manageBranding" },
  { match: /^\/app\/settings\/?$/i, permission: "manageSettings" },
  { match: /^\/app\/staff\/?$/i, permission: "manageStaff" },
  { match: /^\/app\/printing\/?$/i, permission: "managePrinting" },
  { match: /^\/app\/payments\/?$/i, permission: "managePayments" },
  { match: /^\/app\/inventory\/?$/i, permission: "manageMenu" },
  { match: /^\/app\/floor\/?$/i, permission: "viewOrders" },
  { match: /^\/staff\/?$/i, permission: "accessStaffDesk" },
  { match: /^\/kitchen\/?$/i, permission: "accessKitchenDesk" },
  { match: /^\/cashier\/?$/i, permission: "accessCashierDesk" },
];

function mapAuthRoleToDashboardRoles(role: AuthUser["role"] | undefined): DashboardRole[] {
  switch (role) {
    case "restaurant_owner":
      return ["owner"];
    case "restaurant_admin":
      return ["admin"];
    case "restaurant_manager":
      return ["manager"];
    case "restaurant_waiter":
      return ["waiter"];
    case "restaurant_kitchen":
      return ["kitchen"];
    case "staff":
      return ["waiter"];
    default:
      return [];
  }
}

function isDevRoleOverrideEnabled() {
  return import.meta.env.DEV;
}

export function getDevRoleOverride() {
  if (!isDevRoleOverrideEnabled()) return null;
  const raw = localStorage.getItem(DEV_ROLE_OVERRIDE_KEY);
  if (!raw) return null;
  return ROLE_VALUES.includes(raw as DashboardRole) ? (raw as DashboardRole) : null;
}

export function setDevRoleOverride(role: DashboardRole | null) {
  if (!isDevRoleOverrideEnabled()) return;
  if (!role) {
    localStorage.removeItem(DEV_ROLE_OVERRIDE_KEY);
    return;
  }
  localStorage.setItem(DEV_ROLE_OVERRIDE_KEY, role);
}

export function clearDevRoleOverride() {
  if (!isDevRoleOverrideEnabled()) return;
  localStorage.removeItem(DEV_ROLE_OVERRIDE_KEY);
}

export function getRoleConfig(role: DashboardRole) {
  return ROLE_CONFIG[role];
}

export function getRolePermissionMap(role: DashboardRole) {
  return ROLE_CONFIG[role].permissions;
}

export function hasRolePermission(role: DashboardRole, permission: DashboardPermission) {
  return Boolean(ROLE_CONFIG[role].permissions[permission]);
}

export function canCurrentUser(permission: DashboardPermission, user: AuthUser | null = getCurrentUser()) {
  const primaryRole = getPrimaryDashboardRole(user);
  if (!primaryRole) return false;
  return hasRolePermission(primaryRole, permission);
}

export function getAssignedDashboardRoles(user: AuthUser | null = getCurrentUser()) {
  return mapAuthRoleToDashboardRoles(user?.role);
}

export function getPrimaryDashboardRole(user: AuthUser | null = getCurrentUser()): DashboardRole | null {
  const override = getDevRoleOverride();
  if (override) return override;
  const assigned = getAssignedDashboardRoles(user);
  for (const role of ROLE_PRIORITY) {
    if (assigned.includes(role)) return role;
  }
  return null;
}

export function isRoleAllowed(allowedRoles: DashboardRole[], user: AuthUser | null = getCurrentUser()) {
  const assigned = getAssignedDashboardRoles(user);
  return allowedRoles.some((role) => assigned.includes(role));
}

export function getDefaultRouteForRole(role: DashboardRole | null) {
  if (!role) return "/dashboard";
  return ROLE_CONFIG[role].defaultRoute;
}

export function canAccessDashboardRoute(pathname: string, role: DashboardRole | null) {
  if (!role) return false;
  const normalizedPath = pathname.split("?")[0] || pathname;
  const routeEntry = ROUTE_PERMISSION_MAP.find((entry) => entry.match.test(normalizedPath));
  if (!routeEntry) return false;
  return hasRolePermission(role, routeEntry.permission);
}

export function canAccessRoute(role: DashboardRole | null, pathname: string) {
  return canAccessDashboardRoute(pathname, role);
}

export function canPerformAction(action: DashboardAction, user: AuthUser | null = getCurrentUser()) {
  const role = getPrimaryDashboardRole(user);
  if (!role) return false;
  return Boolean(ROLE_CONFIG[role].actions[action]);
}
