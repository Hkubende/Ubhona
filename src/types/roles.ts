export type DashboardRole = "owner" | "admin" | "manager" | "waiter" | "kitchen" | "cashier";

export type DashboardPermission =
  | "viewOverview"
  | "manageMenu"
  | "viewOrders"
  | "updateOrderStatus"
  | "createOrders"
  | "viewAnalytics"
  | "manageBranding"
  | "manageSettings"
  | "printKitchenTicket"
  | "printCustomerReceipt"
  | "printPaymentReceipt"
  | "manageStaff"
  | "managePrinting"
  | "managePayments"
  | "accessStaffDesk"
  | "accessKitchenDesk"
  | "accessCashierDesk";

export type RoleDefinition = {
  id: DashboardRole;
  label: string;
  defaultRoute: string;
  permissions: Record<DashboardPermission, boolean>;
};
