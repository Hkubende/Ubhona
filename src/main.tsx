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
import OrdersDashboard from "./pages/app/OrdersDashboard";
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
import OrderStatusPage from "./pages/storefront/OrderStatusPage";
import { getCurrentUser } from "./lib/auth";
import { hasRestaurantProfile } from "./lib/restaurant";
import { isCurrentUserAdmin } from "./lib/admin";
import "./index.css";

function RequireAppAccess({ children }: { children: React.ReactElement }) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!hasRestaurantProfile()) return <Navigate to="/onboarding" replace />;
  return children;
}

function RequireAuthForOnboarding() {
  if (!getCurrentUser()) return <Navigate to="/login" replace />;
  return <Onboarding />;
}

function RequireAdminAccess({ children }: { children: React.ReactElement }) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!isCurrentUserAdmin()) return <Navigate to="/dashboard" replace />;
  return children;
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
            <RequireAppAccess>
              <Dashboard />
            </RequireAppAccess>
          }
        />
        <Route
          path="/app/menu"
          element={
            <RequireAppAccess>
              <MenuManager />
            </RequireAppAccess>
          }
        />
        <Route
          path="/app/orders"
          element={
            <RequireAppAccess>
              <OrdersDashboard />
            </RequireAppAccess>
          }
        />
        <Route
          path="/app/analytics"
          element={
            <RequireAppAccess>
              <AnalyticsDashboard />
            </RequireAppAccess>
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
        <Route path="/r/:slug/order/:orderId" element={<OrderStatusPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/onboarding" element={<RequireAuthForOnboarding />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
