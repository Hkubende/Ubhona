import { getCurrentUser, type AuthUser } from "./auth";
import type { DashboardPermission, DashboardRole, RoleDefinition } from "../types/roles";

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
      accessStaffDesk: true,
      accessKitchenDesk: true,
      accessCashierDesk: true,
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
      accessStaffDesk: true,
      accessKitchenDesk: true,
      accessCashierDesk: true,
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
      manageBranding: true,
      manageSettings: true,
      printKitchenTicket: true,
      printCustomerReceipt: true,
      printPaymentReceipt: true,
      manageStaff: true,
      managePrinting: true,
      managePayments: true,
      accessStaffDesk: true,
      accessKitchenDesk: true,
      accessCashierDesk: true,
    },
  },
  waiter: {
    id: "waiter",
    label: "Waiter",
    defaultRoute: "/staff",
    permissions: {
      viewOverview: false,
      manageMenu: false,
      viewOrders: true,
      updateOrderStatus: false,
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
      accessStaffDesk: true,
      accessKitchenDesk: false,
      accessCashierDesk: false,
    },
  },
  kitchen: {
    id: "kitchen",
    label: "Kitchen",
    defaultRoute: "/kitchen",
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
      accessStaffDesk: false,
      accessKitchenDesk: true,
      accessCashierDesk: false,
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
      accessStaffDesk: false,
      accessKitchenDesk: false,
      accessCashierDesk: true,
    },
  },
};

const ROLE_PRIORITY: DashboardRole[] = ["owner", "admin", "manager", "waiter", "kitchen", "cashier"];

const ROUTE_PERMISSION_MAP: Array<{ match: RegExp; permission: DashboardPermission }> = [
  { match: /^\/dashboard\/?$/i, permission: "viewOverview" },
  { match: /^\/dashboard\/menu\/?$/i, permission: "manageMenu" },
  { match: /^\/dashboard\/orders\/?$/i, permission: "viewOrders" },
  { match: /^\/dashboard\/analytics\/?$/i, permission: "viewAnalytics" },
  { match: /^\/dashboard\/branding\/?$/i, permission: "manageBranding" },
  { match: /^\/dashboard\/settings\/?$/i, permission: "manageSettings" },
  { match: /^\/dashboard\/staff\/?$/i, permission: "manageStaff" },
  { match: /^\/dashboard\/printing\/?$/i, permission: "managePrinting" },
  { match: /^\/dashboard\/payments\/?$/i, permission: "managePayments" },
  { match: /^\/app\/menu\/?$/i, permission: "manageMenu" },
  { match: /^\/app\/orders\/?$/i, permission: "viewOrders" },
  { match: /^\/dashboard\/orders\/new\/?$/i, permission: "createOrders" },
  { match: /^\/app\/analytics\/?$/i, permission: "viewAnalytics" },
  { match: /^\/app\/branding\/?$/i, permission: "manageBranding" },
  { match: /^\/app\/settings\/?$/i, permission: "manageSettings" },
  { match: /^\/app\/staff\/?$/i, permission: "manageStaff" },
  { match: /^\/app\/printing\/?$/i, permission: "managePrinting" },
  { match: /^\/app\/payments\/?$/i, permission: "managePayments" },
  { match: /^\/staff\/?$/i, permission: "accessStaffDesk" },
  { match: /^\/kitchen\/?$/i, permission: "accessKitchenDesk" },
  { match: /^\/cashier\/?$/i, permission: "accessCashierDesk" },
];

function mapAuthRoleToDashboardRoles(role: AuthUser["role"] | undefined): DashboardRole[] {
  switch (role) {
    case "restaurant_owner":
      return ["owner", "admin", "manager", "waiter", "kitchen", "cashier"];
    case "restaurant_manager":
      return ["manager", "waiter", "kitchen", "cashier"];
    case "staff":
      return ["waiter"];
    default:
      return [];
  }
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
