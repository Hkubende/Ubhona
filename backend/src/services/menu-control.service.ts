import type { BranchDishAvailabilityStatus, BranchDishStockOverride } from "./stock.service.js";

export type EffectiveDishMenuStatus = "available" | "low_stock" | "paused" | "unavailable";
export type DishMenuBlockingReason = "dish_paused" | "branch_unavailable" | "hidden_from_public_menu" | null;

export type EffectiveDishMenuState = {
  branchId: string;
  baseAvailability: boolean;
  stockAvailability: BranchDishAvailabilityStatus;
  hiddenFromPublicMenu: boolean;
  status: EffectiveDishMenuStatus;
  isVisibleOnPublicMenu: boolean;
  isOrderable: boolean;
  blockingReason: DishMenuBlockingReason;
};

export function getEffectiveDishMenuState(input: {
  branchId: string;
  isAvailable: boolean;
  stockOverride?: Pick<BranchDishStockOverride, "availability_status" | "hidden_from_public_menu"> | null;
}): EffectiveDishMenuState {
  const stockAvailability = input.stockOverride?.availability_status || "available";
  const hiddenFromPublicMenu = Boolean(input.stockOverride?.hidden_from_public_menu);

  let status: EffectiveDishMenuStatus = "available";
  if (!input.isAvailable) status = "paused";
  else if (stockAvailability === "unavailable") status = "unavailable";
  else if (stockAvailability === "low_stock") status = "low_stock";

  const isVisibleOnPublicMenu = input.isAvailable && !hiddenFromPublicMenu;
  const isOrderable = input.isAvailable && stockAvailability !== "unavailable" && !hiddenFromPublicMenu;

  let blockingReason: DishMenuBlockingReason = null;
  if (hiddenFromPublicMenu) blockingReason = "hidden_from_public_menu";
  else if (!input.isAvailable) blockingReason = "dish_paused";
  else if (stockAvailability === "unavailable") blockingReason = "branch_unavailable";

  return {
    branchId: input.branchId,
    baseAvailability: input.isAvailable,
    stockAvailability,
    hiddenFromPublicMenu,
    status,
    isVisibleOnPublicMenu,
    isOrderable,
    blockingReason,
  };
}
