import { describe, expect, it } from "vitest";
import {
  ORDER_STATUS_VALUES,
  assertValidOrderStatusTransition,
  getAllowedOrderStatusTransitions,
} from "../services/order-status.service.js";

describe("order-status.service", () => {
  it("exposes the full backend order lifecycle including cancelled", () => {
    expect(ORDER_STATUS_VALUES).toEqual([
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "completed",
      "cancelled",
    ]);
  });

  it("allows forward operational transitions", () => {
    expect(() => assertValidOrderStatusTransition("pending", "confirmed")).not.toThrow();
    expect(() => assertValidOrderStatusTransition("confirmed", "preparing")).not.toThrow();
    expect(() => assertValidOrderStatusTransition("preparing", "ready")).not.toThrow();
    expect(() => assertValidOrderStatusTransition("ready", "completed")).not.toThrow();
  });

  it("allows cancellation before terminal completion", () => {
    expect(getAllowedOrderStatusTransitions("pending")).toContain("cancelled");
    expect(getAllowedOrderStatusTransitions("ready")).toContain("cancelled");
    expect(() => assertValidOrderStatusTransition("ready", "cancelled")).not.toThrow();
  });

  it("rejects invalid or terminal transitions", () => {
    expect(() => assertValidOrderStatusTransition("completed", "preparing")).toThrow(/invalid order status transition/i);
    expect(() => assertValidOrderStatusTransition("cancelled", "confirmed")).toThrow(/invalid order status transition/i);
    expect(() => assertValidOrderStatusTransition("pending", "completed")).toThrow(/invalid order status transition/i);
  });
});
