/* eslint-disable react-refresh/only-export-components */
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ensureDemoReferenceAccount, getCurrentUser, isAuthenticated } from "./lib/auth";
import { hasRestaurantProfile } from "./lib/restaurant";
import { isCurrentUserAdmin } from "./lib/admin";
import { canAccessRoute, getDefaultRouteForRole, getPrimaryDashboardRole, isRoleAllowed } from "./lib/roles";
import type { DashboardRole } from "./types/roles";
import "./index.css";

const App = React.lazy(() => import("./App"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const ARViewer = React.lazy(() => import("./pages/ARViewer"));
const MenuItemPage = React.lazy(() => import("./pages/MenuItemPage"));
const Checkout = React.lazy(() => import("./pages/Checkout"));
const Orders = React.lazy(() => import("./pages/Orders"));
const Login = React.lazy(() => import("./pages/Login"));
const Signup = React.lazy(() => import("./pages/Signup"));
const Onboarding = React.lazy(() => import("./pages/Onboarding"));
const MenuManager = React.lazy(() => import("./pages/MenuManager"));
const Pricing = React.lazy(() => import("./pages/Pricing"));
const OrdersDashboard = React.lazy(() => import("./pages/OrdersDashboard"));
const NewOrderEntryPage = React.lazy(() => import("./pages/NewOrderEntry"));
const Branding = React.lazy(() => import("./pages/Branding"));
const SettingsPage = React.lazy(() => import("./pages/Settings"));
const StaffManagementPage = React.lazy(() => import("./pages/StaffManagement"));
const PrintingCenterPage = React.lazy(() => import("./pages/PrintingCenter"));
const PaymentsCenterPage = React.lazy(() => import("./pages/PaymentsCenter"));
const InventoryPage = React.lazy(() => import("./pages/Inventory"));
const FloorManagerPage = React.lazy(() => import("./pages/FloorManager"));
const AnalyticsDashboard = React.lazy(() => import("./pages/app/AnalyticsDashboard"));
const KitchenDisplayPage = React.lazy(() => import("./pages/app/KitchenDisplayPage"));
const StaffOrdersBoardPage = React.lazy(() => import("./pages/app/StaffOrdersBoardPage"));
const AdminHome = React.lazy(() => import("./pages/admin/AdminHome"));
const RestaurantsAdmin = React.lazy(() => import("./pages/admin/RestaurantsAdmin"));
const BillingAdmin = React.lazy(() => import("./pages/admin/BillingAdmin"));
const SupportAdmin = React.lazy(() => import("./pages/admin/SupportAdmin"));
const PlatformTracker = React.lazy(() => import("./pages/admin/PlatformTracker"));
const RestaurantHome = React.lazy(() => import("./pages/storefront/RestaurantHome"));
const MenuPage = React.lazy(() => import("./pages/storefront/MenuPage"));
const DishPage = React.lazy(() => import("./pages/storefront/DishPage"));
const ARPage = React.lazy(() => import("./pages/storefront/ARPage"));
const CheckoutPage = React.lazy(() => import("./pages/storefront/CheckoutPage"));
const OrderConfirmation = React.lazy(() => import("./pages/storefront/OrderConfirmation"));
const OrderTrackingPage = React.lazy(() => import("./pages/storefront/OrderTrackingPage"));
const StaffDeskPage = React.lazy(() => import("./pages/StaffDesk"));
const KitchenDeskPage = React.lazy(() => import("./pages/KitchenDesk"));
const CashierDeskPage = React.lazy(() => import("./pages/CashierDesk"));

ensureDemoReferenceAccount();

function RequireDashboardRoleAccess({
  children,
  allowedRoles,
}: {
  children: React.ReactElement;
  allowedRoles: DashboardRole[];
}) {
  const location = useLocation();
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (!hasRestaurantProfile()) return <Navigate to="/onboarding" replace />;

  const user = getCurrentUser();
  const primaryRole = getPrimaryDashboardRole(user);
  if (!primaryRole) return <Navigate to="/login" replace />;
  const roleAllowed = isRoleAllowed(allowedRoles, user);
  const routeAllowed = canAccessRoute(primaryRole, location.pathname);
  if (!roleAllowed || !routeAllowed) {
    if (user?.role === "platform_admin") return <Navigate to="/admin" replace />;
    const fallback = getDefaultRouteForRole(primaryRole);
    return <Navigate to={fallback} replace />;
  }
  return children;
}

function RequireAuthForOnboarding() {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (hasRestaurantProfile()) {
    const role = getPrimaryDashboardRole(getCurrentUser());
    return <Navigate to={getDefaultRouteForRole(role)} replace />;
  }
  return <Onboarding />;
}

function RequireAdminAccess({ children }: { children: React.ReactElement }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (!isCurrentUserAdmin()) return <Navigate to="/dashboard" replace />;
  return children;
}

function RedirectAuthed({ children }: { children: React.ReactElement }) {
  if (!isAuthenticated()) return children;
  const user = getCurrentUser();
  if (user?.role === "platform_admin") return <Navigate to="/admin" replace />;
  if (!hasRestaurantProfile()) return <Navigate to="/onboarding" replace />;
  const role = getPrimaryDashboardRole(user);
  return <Navigate to={getDefaultRouteForRole(role)} replace />;
}

function RedirectLegacyRoute({ to }: { to: string }) {
  return <Navigate to={to} replace />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <React.Suspense fallback={<div className="p-4 text-sm text-white/70">Loading...</div>}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/menu/:dishId" element={<MenuItemPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin", "manager"]}>
              <Dashboard />
            </RequireDashboardRoleAccess>
          }
        />
        <Route
          path="/dashboard/menu"
          element={
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin", "manager"]}>
              <MenuManager />
            </RequireDashboardRoleAccess>
          }
        />
        <Route
          path="/dashboard/orders"
          element={
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin", "manager", "waiter"]}>
              <OrdersDashboard />
            </RequireDashboardRoleAccess>
          }
        />
        <Route
          path="/dashboard/kitchen"
          element={
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin", "manager", "kitchen"]}>
              <KitchenDisplayPage />
            </RequireDashboardRoleAccess>
          }
        />
        <Route
          path="/dashboard/staff-orders"
          element={
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin", "manager", "waiter"]}>
              <StaffOrdersBoardPage />
            </RequireDashboardRoleAccess>
          }
        />
        <Route
          path="/dashboard/orders/new"
          element={
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin", "manager", "waiter"]}>
              <NewOrderEntryPage />
            </RequireDashboardRoleAccess>
          }
        />
        <Route
          path="/dashboard/analytics"
          element={
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin", "manager"]}>
              <AnalyticsDashboard />
            </RequireDashboardRoleAccess>
          }
        />
        <Route
          path="/dashboard/branding"
          element={
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin", "manager"]}>
              <Branding />
            </RequireDashboardRoleAccess>
          }
        />
        <Route
          path="/dashboard/settings"
          element={
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin", "manager"]}>
              <SettingsPage />
            </RequireDashboardRoleAccess>
          }
        />
        <Route
          path="/dashboard/staff"
          element={
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin", "manager"]}>
              <StaffManagementPage />
            </RequireDashboardRoleAccess>
          }
        />
        <Route
          path="/dashboard/printing"
          element={
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin", "manager"]}>
              <PrintingCenterPage />
            </RequireDashboardRoleAccess>
          }
        />
        <Route
          path="/dashboard/payments"
          element={
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin", "manager"]}>
              <PaymentsCenterPage />
            </RequireDashboardRoleAccess>
          }
        />
        <Route
          path="/dashboard/inventory"
          element={
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin", "manager"]}>
              <InventoryPage />
            </RequireDashboardRoleAccess>
          }
        />
        <Route
          path="/dashboard/floor"
          element={
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin", "manager", "waiter"]}>
              <FloorManagerPage />
            </RequireDashboardRoleAccess>
          }
        />
        <Route
          path="/dashboard/billing"
          element={
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin"]}>
              <Pricing />
            </RequireDashboardRoleAccess>
          }
        />
        <Route path="/app/menu" element={<RedirectLegacyRoute to="/dashboard/menu" />} />
        <Route path="/app/orders" element={<RedirectLegacyRoute to="/dashboard/orders" />} />
        <Route path="/app/kitchen" element={<RedirectLegacyRoute to="/dashboard/kitchen" />} />
        <Route path="/app/staff-orders" element={<RedirectLegacyRoute to="/dashboard/staff-orders" />} />
        <Route path="/app/analytics" element={<RedirectLegacyRoute to="/dashboard/analytics" />} />
        <Route path="/app/branding" element={<RedirectLegacyRoute to="/dashboard/branding" />} />
        <Route path="/app/settings" element={<RedirectLegacyRoute to="/dashboard/settings" />} />
        <Route path="/app/staff" element={<RedirectLegacyRoute to="/dashboard/staff" />} />
        <Route path="/app/printing" element={<RedirectLegacyRoute to="/dashboard/printing" />} />
        <Route path="/app/payments" element={<RedirectLegacyRoute to="/dashboard/payments" />} />
        <Route path="/app/inventory" element={<RedirectLegacyRoute to="/dashboard/inventory" />} />
        <Route path="/app/floor" element={<RedirectLegacyRoute to="/dashboard/floor" />} />
        <Route path="/app/billing" element={<RedirectLegacyRoute to="/dashboard/billing" />} />
        <Route
          path="/staff"
          element={
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin", "manager", "waiter"]}>
              <StaffDeskPage />
            </RequireDashboardRoleAccess>
          }
        />
        <Route
          path="/kitchen"
          element={
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin", "manager", "kitchen"]}>
              <KitchenDeskPage />
            </RequireDashboardRoleAccess>
          }
        />
        <Route
          path="/cashier"
          element={
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin", "manager", "cashier"]}>
              <CashierDeskPage />
            </RequireDashboardRoleAccess>
          }
        />
        <Route path="/ar" element={<ARViewer />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route
          path="/admin"
          element={
            <RequireAdminAccess>
              <AdminHome />
            </RequireAdminAccess>
          }
        />
        <Route
          path="/admin/restaurants"
          element={
            <RequireAdminAccess>
              <RestaurantsAdmin />
            </RequireAdminAccess>
          }
        />
        <Route
          path="/admin/billing"
          element={
            <RequireAdminAccess>
              <BillingAdmin />
            </RequireAdminAccess>
          }
        />
        <Route
          path="/admin/support"
          element={
            <RequireAdminAccess>
              <SupportAdmin />
            </RequireAdminAccess>
          }
        />
        <Route
          path="/platform-tracker"
          element={
            <RequireAdminAccess>
              <PlatformTracker />
            </RequireAdminAccess>
          }
        />
        <Route path="/r/:slug" element={<RestaurantHome />} />
        <Route path="/r/:slug/menu" element={<MenuPage />} />
        <Route path="/r/:restaurantSlug/dish/:dishId" element={<DishPage />} />
        <Route path="/r/:slug/ar" element={<ARPage />} />
        <Route path="/r/:slug/checkout" element={<CheckoutPage />} />
        <Route path="/r/:slug/order/:orderId" element={<OrderConfirmation />} />
        <Route path="/r/:slug/confirmation" element={<OrderConfirmation />} />
        <Route path="/order/:orderId" element={<OrderTrackingPage />} />
        <Route
          path="/login"
          element={
            <RedirectAuthed>
              <Login />
            </RedirectAuthed>
          }
        />
        <Route
          path="/signup"
          element={
            <RedirectAuthed>
              <Signup />
            </RedirectAuthed>
          }
        />
        <Route path="/onboarding" element={<RequireAuthForOnboarding />} />
      </Routes>
      </React.Suspense>
    </BrowserRouter>
  </React.StrictMode>
);
