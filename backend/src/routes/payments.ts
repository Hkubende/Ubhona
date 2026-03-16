import { Router } from "express";
import { z } from "zod";
import { getOrderPaymentStatus, handleStkCallback, initiateStkPushForOrder } from "../services/payment.service.js";

export const paymentsRouter = Router();

paymentsRouter.post("/stk", async (req, res) => {
  try {
    const body = z
      .object({
        orderId: z.string().min(1),
        phone: z.string().min(1),
        restaurantId: z.string().min(1).optional(),
      })
      .parse(req.body);
    const result = await initiateStkPushForOrder(body);
    if (!result.accepted) {
      res.status(400).json({
        ok: false,
        error: result.error,
        paymentId: result.payment.id,
      });
      return;
    }
    res.json({
      ok: true,
      paymentId: result.payment.id,
      checkoutRequestId: result.checkoutRequestId,
      message: "Payment prompt sent to phone.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send STK push.";
    const status = /not found/i.test(message) ? 404 : 400;
    res.status(status).json({ ok: false, error: message });
  }
});

paymentsRouter.post("/callback", async (req, res) => {
  try {
    const result = await handleStkCallback((req.body || {}) as any);
    if (result.ignored) {
      res.json({ ok: true, ignored: true });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Callback handling failed.";
    res.status(400).json({ ok: false, error: message });
  }
});

paymentsRouter.get("/:orderId/status", async (req, res) => {
  try {
    const params = z.object({ orderId: z.string().min(1) }).parse(req.params);
    const query = z.object({ restaurantId: z.string().min(1).optional() }).parse(req.query);
    const result = await getOrderPaymentStatus({
      orderId: params.orderId,
      restaurantId: query.restaurantId,
    });
    res.json({
      ok: true,
      orderId: result.order.id,
      restaurantId: result.order.restaurantId,
      paymentStatus: result.order.paymentStatus,
      orderStatus: result.order.status,
      paymentMethod: result.order.paymentMethod,
      paymentReference: result.order.paymentReference,
      payment: result.payment,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load payment status.";
    const status = /not found/i.test(message) ? 404 : 400;
    res.status(status).json({ ok: false, error: message });
  }
});
