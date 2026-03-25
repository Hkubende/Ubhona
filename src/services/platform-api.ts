import { getAnalyticsSummary, trackAnalyticsEvent } from "../lib/analytics";
import {
  getRestaurantDashboardData,
  getOrders,
  setOrderStatus,
  type OrderStatus,
} from "../lib/dashboard-data";
import {
  createStorefrontOrder,
  getStorefrontOrder,
  setLocalStorefrontOrderPayment,
  type OrderPaymentMethod,
} from "../lib/orders";
import { emitAutomationEvent, getCurrentBranchId } from "./automation-engine";
import {
  getBrandingSettings,
  getCategories,
  getDishes,
} from "../lib/dashboard-data";
import type { StorefrontCreateOrderPayload } from "../lib/orders";

export const platformApi = {
  dashboard: {
    getData: getRestaurantDashboardData,
  },
  menu: {
    getCategories,
    getDishes,
    getBrandingSettings,
  },
  orders: {
    list: getOrders,
    setStatus: (restaurantId: string, orderId: string, status: OrderStatus) =>
      setOrderStatus(restaurantId, orderId, status),
    createStorefrontOrder,
    getStorefrontOrder,
  },
  payments: {
    updateLocalOrderPayment: async (
      orderId: string,
      restaurantId: string,
      payment: {
        paymentMethod?: OrderPaymentMethod;
        paymentStatus?: string;
        paymentReference?: string;
      }
    ) => {
      const updated = setLocalStorefrontOrderPayment(orderId, restaurantId, payment);
      if (updated) {
        const status = String(updated.paymentStatus || "").toLowerCase();
        if (status === "paid" || status === "succeeded") {
          await emitAutomationEvent({
            type: "PAYMENT_COMPLETED",
            context: {
              restaurantId,
              branchId: getCurrentBranchId(),
              role: "customer",
              order: {
                id: updated.id,
                createdAt: updated.createdAt,
                customerName: updated.customerName,
                customerPhone: updated.customerPhone,
                tableNumber: updated.tableNumber,
                customerNotes: updated.customerNotes,
                paymentStatus: updated.paymentStatus,
                paymentMethod: updated.paymentMethod,
                paymentReference: updated.paymentReference,
                subtotal: updated.subtotal,
                total: updated.total,
                status: updated.status,
                items: updated.items.map((item) => ({
                  name: item.name,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  totalPrice: item.subtotal,
                })),
              },
              metadata: { paymentStatus: updated.paymentStatus },
            },
          });
        } else if (status === "failed" || status === "cancelled" || status === "timeout") {
          await emitAutomationEvent({
            type: "PAYMENT_FAILED",
            context: {
              restaurantId,
              branchId: getCurrentBranchId(),
              role: "customer",
              order: {
                id: updated.id,
                createdAt: updated.createdAt,
                customerName: updated.customerName,
                customerPhone: updated.customerPhone,
                tableNumber: updated.tableNumber,
                customerNotes: updated.customerNotes,
                paymentStatus: updated.paymentStatus,
                paymentMethod: updated.paymentMethod,
                paymentReference: updated.paymentReference,
                subtotal: updated.subtotal,
                total: updated.total,
                status: updated.status,
                items: updated.items.map((item) => ({
                  name: item.name,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  totalPrice: item.subtotal,
                })),
              },
              metadata: { paymentStatus: updated.paymentStatus },
            },
          });
        }
      }
      return updated;
    },
  },
  analytics: {
    getSummary: getAnalyticsSummary,
    trackEvent: trackAnalyticsEvent,
  },
};

export type PlatformApi = typeof platformApi;
export type { StorefrontCreateOrderPayload };
