import { describe, expect, it } from "vitest";
import { getEffectiveDishMenuState } from "../services/menu-control.service.js";

describe("menu-control.service", () => {
  it("marks a dish paused when the base dish flag is disabled", () => {
    expect(
      getEffectiveDishMenuState({
        branchId: "main",
        isAvailable: false,
      })
    ).toMatchObject({
      status: "paused",
      isOrderable: false,
      isVisibleOnPublicMenu: false,
      blockingReason: "dish_paused",
    });
  });

  it("marks a dish unavailable when the branch override disables it", () => {
    expect(
      getEffectiveDishMenuState({
        branchId: "main",
        isAvailable: true,
        stockOverride: {
          availability_status: "unavailable",
          hidden_from_public_menu: false,
        },
      })
    ).toMatchObject({
      status: "unavailable",
      isOrderable: false,
      isVisibleOnPublicMenu: true,
      blockingReason: "branch_unavailable",
    });
  });

  it("keeps low-stock dishes visible and orderable", () => {
    expect(
      getEffectiveDishMenuState({
        branchId: "main",
        isAvailable: true,
        stockOverride: {
          availability_status: "low_stock",
          hidden_from_public_menu: false,
        },
      })
    ).toMatchObject({
      status: "low_stock",
      isOrderable: true,
      isVisibleOnPublicMenu: true,
      blockingReason: null,
    });
  });

  it("treats hidden dishes as not orderable even when stock is available", () => {
    expect(
      getEffectiveDishMenuState({
        branchId: "main",
        isAvailable: true,
        stockOverride: {
          availability_status: "available",
          hidden_from_public_menu: true,
        },
      })
    ).toMatchObject({
      status: "available",
      isOrderable: false,
      isVisibleOnPublicMenu: false,
      blockingReason: "hidden_from_public_menu",
    });
  });
});
