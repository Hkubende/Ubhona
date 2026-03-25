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
  | "manageBilling"
  | "accessStaffDesk"
  | "accessKitchenDesk"
  | "accessCashierDesk";

export type DashboardAction =
  | "manage_menu"
  | "manage_stock"
  | "edit_price"
  | "create_order"
  | "update_kitchen_status"
  | "update_service_order_status"
  | "manage_staff"
  | "manage_branding"
  | "manage_billing"
  | "manage_settings"
  | "print_ticket";

export type RoleDefinition = {
  id: DashboardRole;
  label: string;
  defaultRoute: string;
  permissions: Record<DashboardPermission, boolean>;
  actions: Record<DashboardAction, boolean>;
};
