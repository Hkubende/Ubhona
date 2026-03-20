import * as React from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "../components/dashboard/dashboard-layout";
import {
  ContentGrid,
  DashboardPanel,
  EmptyStateCard,
  PageContainer,
  SectionHeader,
} from "../components/dashboard/dashboard-primitives";
import { UbhonaDropdown } from "../components/ui/ubhona-dropdown";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import {
  getActiveRestaurantId,
  getCategories,
  getDashboardRestaurant,
  getDishes,
} from "../lib/dashboard-data";
import { createPaymentReference, createStorefrontOrder } from "../lib/orders";
import type { Category, Dish, Restaurant } from "../types/dashboard";
import type { RestaurantProfile } from "../lib/restaurant";
import {
  clearWaiterSession,
  createWaiterSession,
  getWaiterSession,
  getWaiters,
  type Waiter,
  type WaiterSession,
} from "../lib/waiters";
import { cn } from "../lib/utils";
import { spacing, tokens, typography } from "../design-system";

type CartState = Record<string, number>;

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

export default function NewOrderEntryPage() {
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = React.useState<Restaurant | null>(null);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [dishes, setDishes] = React.useState<Dish[]>([]);
  const [cart, setCart] = React.useState<CartState>({});
  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [tableNumber, setTableNumber] = React.useState("");
  const [customerNotes, setCustomerNotes] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeCategoryId, setActiveCategoryId] = React.useState("all");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [waiters, setWaiters] = React.useState<Waiter[]>([]);
  const [selectedWaiterCode, setSelectedWaiterCode] = React.useState("");
  const [waiterPin, setWaiterPin] = React.useState("");
  const [waiterSession, setWaiterSession] = React.useState<WaiterSession | null>(null);
  const [waiterMessage, setWaiterMessage] = React.useState("");

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const restaurantId = await getActiveRestaurantId();
        const [restaurantData, categoriesData, dishesData] = await Promise.all([
          getDashboardRestaurant(restaurantId),
          getCategories(restaurantId),
          getDishes(restaurantId),
        ]);
        if (!mounted) return;
        setRestaurant(restaurantData);
        setCategories(categoriesData);
        setDishes(dishesData.filter((dish) => dish.available));
        const waiterRows = getWaiters(restaurantData.id);
        setWaiters(waiterRows);
        setSelectedWaiterCode(waiterRows[0]?.code || "");
        setWaiterSession(getWaiterSession(restaurantData.id));
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load menu data.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const profile = React.useMemo<RestaurantProfile | null>(() => {
    if (!restaurant) return null;
    return {
      id: restaurant.id,
      restaurantName: restaurant.name,
      slug: restaurant.slug,
      phone: restaurant.phone,
      email: restaurant.email,
      location: restaurant.location,
      logo: restaurant.logoUrl,
      coverImage: restaurant.coverImageUrl,
      themePrimary: restaurant.primaryColor || "#E4572E",
      themeSecondary: "#E8D8C3",
      shortDescription: restaurant.description,
      subscriptionPlan: restaurant.subscriptionPlan || "starter",
      subscriptionStatus: restaurant.subscriptionStatus || "active",
      trialEndsAt: null,
      renewalDate: null,
      createdAt: new Date().toISOString(),
    };
  }, [restaurant]);

  const dishesById = React.useMemo(() => new Map(dishes.map((dish) => [dish.id, dish])), [dishes]);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredDishes = React.useMemo(() => {
    return dishes.filter((dish) => {
      if (activeCategoryId !== "all" && dish.categoryId !== activeCategoryId) return false;
      if (!normalizedQuery) return true;
      const haystack = `${dish.name} ${dish.description}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [dishes, activeCategoryId, normalizedQuery]);

  const groupedFiltered = React.useMemo(() => {
    const map = new Map<string, Dish[]>();
    for (const dish of filteredDishes) {
      const bucket = map.get(dish.categoryId) || [];
      bucket.push(dish);
      map.set(dish.categoryId, bucket);
    }
    return map;
  }, [filteredDishes]);

  const cartLines = React.useMemo(() => {
    return Object.entries(cart)
      .map(([dishId, quantity]) => {
        const dish = dishesById.get(dishId);
        if (!dish || quantity <= 0) return null;
        const subtotal = quantity * dish.price;
        return { dish, quantity, subtotal };
      })
      .filter((line): line is { dish: Dish; quantity: number; subtotal: number } => Boolean(line));
  }, [cart, dishesById]);

  const total = React.useMemo(() => cartLines.reduce((sum, line) => sum + line.subtotal, 0), [cartLines]);
  const activeWaiters = React.useMemo(() => waiters.filter((waiter) => waiter.active), [waiters]);

  const signInWaiter = () => {
    if (!restaurant) return;
    setWaiterMessage("");
    try {
      const session = createWaiterSession({
        restaurantId: restaurant.id,
        waiterCode: selectedWaiterCode,
        pin: waiterPin,
      });
      setWaiterSession(session);
      setWaiterMessage(`Logged in as ${session.name}.`);
    } catch (err) {
      setWaiterMessage(err instanceof Error ? err.message : "Failed to sign in waiter.");
    }
  };

  const signOutWaiter = () => {
    clearWaiterSession();
    setWaiterSession(null);
    setWaiterMessage("Waiter session cleared.");
  };

  const addDish = (dishId: string) => {
    setCart((prev) => ({ ...prev, [dishId]: (prev[dishId] || 0) + 1 }));
  };

  const setDishQty = (dishId: string, quantity: number) => {
    setCart((prev) => {
      const next = { ...prev };
      if (quantity <= 0) {
        delete next[dishId];
      } else {
        next[dishId] = quantity;
      }
      return next;
    });
  };

  const submitOrder = async () => {
    if (!restaurant) return;
    if (!cartLines.length) {
      setError("Add at least one item before placing the order.");
      return;
    }

    if (!customerName.trim() && !tableNumber.trim()) {
      setError("Provide customer name or table number.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const source = waiterSession?.loggedIn ? "waiter" : "admin";
      const orderId = await createStorefrontOrder({
        restaurantId: restaurant.id,
        restaurantSlug: restaurant.slug,
        source,
        takenByWaiterId: waiterSession?.waiterId || undefined,
        takenByWaiterName: waiterSession?.name || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        tableNumber: tableNumber.trim() || undefined,
        customerNotes: customerNotes.trim() || undefined,
        createdAt: new Date().toISOString(),
        status: "pending",
        paymentMethod: "manual_mpesa",
        paymentStatus: "unpaid",
        paymentReference: `ADMIN-${createPaymentReference()}`,
        items: cartLines.map((line) => ({
          dishId: line.dish.id,
          quantity: line.quantity,
        })),
        itemSnapshots: cartLines.map((line) => ({
          dishId: line.dish.id,
          name: line.dish.name,
          quantity: line.quantity,
          unitPrice: line.dish.price,
          subtotal: line.subtotal,
        })),
        subtotalAmount: total,
        totalAmount: total,
      });

      navigate(`/dashboard/orders?created=${encodeURIComponent(orderId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      profile={profile}
      title="New Admin Order"
      subtitle="Create an order on behalf of a walk-in or assisted customer."
    >
      <PageContainer>
      {loading ? <DashboardPanel className={typography.body}>Loading menu...</DashboardPanel> : null}
      {error ? <EmptyStateCard message={error} /> : null}

      {!loading && restaurant ? (
        <ContentGrid className="xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <DashboardPanel>
            <SectionHeader title="Menu Selection" subtitle="Select dishes from the current restaurant menu." />
            <div className="mb-3 flex flex-wrap gap-2">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search dishes..."
                className="min-w-56 flex-1"
              />
            </div>
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              <Button
                size="sm"
                variant={activeCategoryId === "all" ? "primary" : "secondary"}
                onClick={() => setActiveCategoryId("all")}
                className="shrink-0"
              >
                All
              </Button>
              {categories.map((category) => (
                <Button
                  key={category.id}
                  size="sm"
                  variant={activeCategoryId === category.id ? "primary" : "secondary"}
                  onClick={() => setActiveCategoryId(category.id)}
                  className="shrink-0"
                >
                  {category.name}
                </Button>
              ))}
            </div>

            <div className={spacing.stackLg}>
              {categories.map((category) => {
                const items = groupedFiltered.get(category.id) || [];
                if (!items.length) return null;
                return (
                  <div key={category.id}>
                    <h3 className={cn("mb-2", typography.label, "text-text-secondary")}>{category.name}</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {items.map((dish) => (
                        <article key={dish.id} className={cn(tokens.classes.panelInset, "p-3")}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold text-text-primary">{dish.name}</div>
                              <div className="text-xs text-text-secondary/68">{dish.description}</div>
                            </div>
                            <div className="text-xs font-semibold text-primary">{formatKsh(dish.price)}</div>
                          </div>
                          <div className="mt-2">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => addDish(dish.id)}
                            >
                              Add
                            </Button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </DashboardPanel>

          <DashboardPanel>
            <SectionHeader title="Cart & Customer" subtitle="Attach customer/table details and submit order." />
            <div className={cn(tokens.classes.panelInset, "mb-4 p-3")}>
              <div className={cn("mb-2", typography.label)}>Waiter Login</div>
              {activeWaiters.length ? (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <UbhonaDropdown
                      id="new-order-waiter-code"
                      name="newOrderWaiterCode"
                      value={selectedWaiterCode}
                      onValueChange={setSelectedWaiterCode}
                      placeholder="Select waiter"
                      searchable
                      items={activeWaiters.map((waiter) => ({
                        value: waiter.code,
                        label: `${waiter.name} (${waiter.code})`,
                        description: waiter.pin ? "PIN protected" : "No PIN",
                      }))}
                    />
                    <Input
                      value={waiterPin}
                      onChange={(event) => setWaiterPin(event.target.value)}
                      placeholder="Waiter PIN (if set)"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={signInWaiter}
                    >
                      Sign In Waiter
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={signOutWaiter}
                    >
                      Clear
                    </Button>
                    <span className="text-xs text-text-secondary/70">
                      Session: {waiterSession?.loggedIn ? waiterSession.name : "Admin mode"}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-text-secondary/68">No active waiters. Orders will be recorded as admin.</div>
              )}
              {waiterMessage ? <div className="mt-2 text-xs text-text-secondary/70">{waiterMessage}</div> : null}
            </div>
            {cartLines.length ? (
              <div className={spacing.stackSm}>
                {cartLines.map((line) => (
                  <div key={line.dish.id} className={cn(tokens.classes.panelInset, "p-3")}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-text-primary">{line.dish.name}</div>
                        <div className="text-xs text-text-secondary/68">{formatKsh(line.dish.price)} each</div>
                      </div>
                      <div className="text-xs font-semibold text-primary">{formatKsh(line.subtotal)}</div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 min-h-7 px-2"
                        onClick={() => setDishQty(line.dish.id, line.quantity - 1)}
                      >
                        -
                      </Button>
                      <span className="text-sm">{line.quantity}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 min-h-7 px-2"
                        onClick={() => setDishQty(line.dish.id, line.quantity + 1)}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyStateCard message="Cart is empty. Add dishes to start a new order." />
            )}

            <div className={cn("mt-4", spacing.stackSm)}>
              <Input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Customer name (optional if table is set)"
              />
              <Input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="Customer phone (optional)"
              />
              <Input
                value={tableNumber}
                onChange={(event) => setTableNumber(event.target.value)}
                placeholder="Table number (optional if customer name is set)"
              />
              <Textarea
                value={customerNotes}
                onChange={(event) => setCustomerNotes(event.target.value)}
                placeholder="Order notes"
                rows={3}
              />
            </div>

            <div className={cn(tokens.classes.panelInset, "mt-4 flex items-center justify-between px-3 py-2")}>
              <span className="text-sm text-text-secondary/70">Total</span>
              <span className="text-lg font-semibold text-primary">{formatKsh(total)}</span>
            </div>

            <Button
              onClick={() => void submitOrder()}
              disabled={!cartLines.length || saving}
              variant="primary"
              size="lg"
              className="mt-4 w-full"
            >
              {saving ? "Placing Order..." : "Place Admin Order"}
            </Button>
          </DashboardPanel>
        </ContentGrid>
      ) : null}
      </PageContainer>
    </DashboardLayout>
  );
}
