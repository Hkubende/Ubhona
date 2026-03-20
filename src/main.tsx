/* eslint-disable react-refresh/only-export-components */
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "./App";
import Dashboard from "./pages/Dashboard";
import ARViewer from "./pages/ARViewer";
import MenuItemPage from "./pages/MenuItemPage";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Onboarding from "./pages/Onboarding";
import MenuManager from "./pages/MenuManager";
import Pricing from "./pages/Pricing";
import OrdersDashboard from "./pages/OrdersDashboard";
import NewOrderEntryPage from "./pages/NewOrderEntry";
import Branding from "./pages/Branding";
import SettingsPage from "./pages/Settings";
import StaffManagementPage from "./pages/StaffManagement";
import PrintingCenterPage from "./pages/PrintingCenter";
import PaymentsCenterPage from "./pages/PaymentsCenter";
import AnalyticsDashboard from "./pages/app/AnalyticsDashboard";
import AdminHome from "./pages/admin/AdminHome";
import RestaurantsAdmin from "./pages/admin/RestaurantsAdmin";
import BillingAdmin from "./pages/admin/BillingAdmin";
import SupportAdmin from "./pages/admin/SupportAdmin";
import PlatformTracker from "./pages/admin/PlatformTracker";
import RestaurantHome from "./pages/storefront/RestaurantHome";
import MenuPage from "./pages/storefront/MenuPage";
import ARPage from "./pages/storefront/ARPage";
import CheckoutPage from "./pages/storefront/CheckoutPage";
import OrderConfirmation from "./pages/storefront/OrderConfirmation";
import { ensureDemoReferenceAccount, getCurrentUser, isAuthenticated } from "./lib/auth";
import { hasRestaurantProfile } from "./lib/restaurant";
import { isCurrentUserAdmin } from "./lib/admin";
import StaffDeskPage from "./pages/StaffDesk";
import KitchenDeskPage from "./pages/KitchenDesk";
import CashierDeskPage from "./pages/CashierDesk";
import { getDefaultRouteForRole, getPrimaryDashboardRole, isRoleAllowed } from "./lib/roles";
import type { DashboardRole } from "./types/roles";
import "./index.css";

ensureDemoReferenceAccount();

function RequireDashboardRoleAccess({
  children,
  allowedRoles,
}: {
  children: React.ReactElement;
  allowedRoles: DashboardRole[];
}) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (!hasRestaurantProfile()) return <Navigate to="/onboarding" replace />;

  const user = getCurrentUser();
  const primaryRole = getPrimaryDashboardRole(user);
  if (!isRoleAllowed(allowedRoles, user)) {
    if (user?.role === "platform_admin") return <Navigate to="/admin" replace />;
    if (!primaryRole) return <Navigate to="/login" replace />;
    const fallback = getDefaultRouteForRole(primaryRole);
    return <Navigate to={fallback} replace />;
  }
  return children;
}

function RequireAuthForOnboarding() {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (hasRestaurantProfile()) return <Navigate to="/dashboard" replace />;
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
  return <Navigate to={hasRestaurantProfile() ? "/dashboard" : "/onboarding"} replace />;
}

function RedirectLegacyRoute({ to }: { to: string }) {
  return <Navigate to={to} replace />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
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
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin", "manager"]}>
              <OrdersDashboard />
            </RequireDashboardRoleAccess>
          }
        />
        <Route
          path="/dashboard/orders/new"
          element={
            <RequireDashboardRoleAccess allowedRoles={["owner", "admin", "manager"]}>
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
        <Route path="/app/menu" element={<RedirectLegacyRoute to="/dashboard/menu" />} />
        <Route path="/app/orders" element={<RedirectLegacyRoute to="/dashboard/orders" />} />
        <Route path="/app/analytics" element={<RedirectLegacyRoute to="/dashboard/analytics" />} />
        <Route path="/app/branding" element={<RedirectLegacyRoute to="/dashboard/branding" />} />
        <Route path="/app/settings" element={<RedirectLegacyRoute to="/dashboard/settings" />} />
        <Route path="/app/staff" element={<RedirectLegacyRoute to="/dashboard/staff" />} />
        <Route path="/app/printing" element={<RedirectLegacyRoute to="/dashboard/printing" />} />
        <Route path="/app/payments" element={<RedirectLegacyRoute to="/dashboard/payments" />} />
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
        <Route path="/r/:slug/ar" element={<ARPage />} />
        <Route path="/r/:slug/checkout" element={<CheckoutPage />} />
        <Route path="/r/:slug/order/:orderId" element={<OrderConfirmation />} />
        <Route path="/r/:slug/confirmation" element={<OrderConfirmation />} />
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
    </BrowserRouter>
  </React.StrictMode>
);
