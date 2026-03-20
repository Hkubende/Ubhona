import * as React from "react";
import { DashboardLayout } from "../components/dashboard/dashboard-layout";
import {
  ActionBar,
  ContentGrid,
  DashboardPanel,
  EmptyStateCard,
  PageContainer,
  SectionHeader,
  StatusBadge,
} from "../components/dashboard/dashboard-primitives";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { UbhonaDropdown } from "../components/ui/ubhona-dropdown";
import { Textarea } from "../components/ui/Textarea";
import { Badge } from "../components/ui/Badge";
import {
  getActiveRestaurantId,
  getCategories,
  getDashboardRestaurant,
  getDishes,
  getOrders,
} from "../lib/dashboard-data";
import { createPaymentReference, createStorefrontOrder } from "../lib/orders";
import { getCurrentUser } from "../lib/auth";
import { canCurrentUser } from "../lib/roles";
import { printCustomerReceipt } from "../lib/print";
import type { PrintOrder } from "../lib/print";
import {
  clearWaiterSession,
  createWaiterSession,
  getWaiterSession,
  getWaiters,
  type Waiter,
  type WaiterSession,
} from "../lib/waiters";
import type { Category, Dish, Order, Restaurant } from "../types/dashboard";
import type { RestaurantProfile } from "../lib/restaurant";

type CartState = Record<string, number>;

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export default function StaffDeskPage() {
  const currentUser = getCurrentUser();
  const [restaurant, setRestaurant] = React.useState<Restaurant | null>(null);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [dishes, setDishes] = React.useState<Dish[]>([]);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [waiters, setWaiters] = React.useState<Waiter[]>([]);
  const [waiterSession, setWaiterSession] = React.useState<WaiterSession | null>(null);
  const [selectedWaiterCode, setSelectedWaiterCode] = React.useState("");
  const [waiterPin, setWaiterPin] = React.useState("");
  const [waiterMessage, setWaiterMessage] = React.useState("");

  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeCategoryId, setActiveCategoryId] = React.useState("all");
  const [cart, setCart] = React.useState<CartState>({});

  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [tableNumber, setTableNumber] = React.useState("");
  const [customerNotes, setCustomerNotes] = React.useState("");

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const canPrintCustomer = canCurrentUser("printCustomerReceipt");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const restaurantId = await getActiveRestaurantId();
      const [restaurantData, categoriesData, dishesData, ordersData] = await Promise.all([
        getDashboardRestaurant(restaurantId),
        getCategories(restaurantId),
        getDishes(restaurantId),
        getOrders(restaurantId),
      ]);

      const waiterRows = getWaiters(restaurantData.id).filter((waiter) => waiter.active);
      setRestaurant(restaurantData);
      setCategories(categoriesData);
      setDishes(dishesData.filter((dish) => dish.available));
      setOrders(ordersData);
      setWaiters(waiterRows);
      setWaiterSession(getWaiterSession(restaurantData.id));
      if (waiterRows.length) {
        setSelectedWaiterCode((current) => current || waiterRows[0].code);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff workspace data.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

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
  const searched = normalizeSearch(searchQuery);

  const filteredDishes = React.useMemo(() => {
    return dishes.filter((dish) => {
      if (activeCategoryId !== "all" && dish.categoryId !== activeCategoryId) return false;
      if (!searched) return true;
      return `${dish.name} ${dish.description}`.toLowerCase().includes(searched);
    });
  }, [dishes, activeCategoryId, searched]);

  const groupedDishes = React.useMemo(() => {
    const map = new Map<string, Dish[]>();
    for (const dish of filteredDishes) {
      const rows = map.get(dish.categoryId) || [];
      rows.push(dish);
      map.set(dish.categoryId, rows);
    }
    return map;
  }, [filteredDishes]);

  const cartLines = React.useMemo(() => {
    return Object.entries(cart)
      .map(([dishId, quantity]) => {
        const dish = dishesById.get(dishId);
        if (!dish || quantity <= 0) return null;
        return {
          dish,
          quantity,
          subtotal: quantity * dish.price,
        };
      })
      .filter((line): line is { dish: Dish; quantity: number; subtotal: number } => Boolean(line));
  }, [cart, dishesById]);

  const cartTotal = React.useMemo(() => cartLines.reduce((sum, line) => sum + line.subtotal, 0), [cartLines]);
  const waiterIdentity = React.useMemo(() => {
    if (waiterSession?.loggedIn) {
      return {
        id: waiterSession.waiterId,
        name: waiterSession.name,
      };
    }
    return {
      id: currentUser?.id || "staff-user",
      name: currentUser?.name || "Staff",
    };
  }, [waiterSession, currentUser]);

  const myActiveOrders = React.useMemo(() => {
    if (!waiterIdentity.id && !waiterIdentity.name) return [];
    return orders
      .filter((order) => order.source === "waiter")
      .filter((order) => order.status !== "completed")
      .filter((order) =>
        order.takenByWaiterId
          ? order.takenByWaiterId === waiterIdentity.id
          : order.takenByWaiterName === waiterIdentity.name
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders, waiterIdentity]);

  const toCustomerPrintOrder = React.useCallback(
    (order: Order): PrintOrder => ({
      id: order.id,
      restaurant: {
        name: restaurant?.name || "Ubhona Restaurant",
        footerText: "Powered by Ubhona",
      },
      createdAt: order.createdAt,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      takenByWaiterName: order.takenByWaiterName,
      tableNumber: order.tableNumber,
      notes: order.customerNotes,
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      subtotal: order.subtotal,
      total: order.total,
      payment: {
        status: order.paymentStatus || "unpaid",
        method: order.paymentMethod || "manual_mpesa",
        transactionId: order.paymentReference || undefined,
      },
    }),
    [restaurant]
  );

  const setDishQty = (dishId: string, quantity: number) => {
    setCart((prev) => {
      const next = { ...prev };
      if (quantity <= 0) delete next[dishId];
      else next[dishId] = quantity;
      return next;
    });
  };

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
      setWaiterMessage(`Signed in as ${session.name}.`);
    } catch (err) {
      setWaiterMessage(err instanceof Error ? err.message : "Failed to sign in waiter.");
    }
  };

  const signOutWaiter = () => {
    clearWaiterSession();
    setWaiterSession(null);
    setWaiterMessage("Waiter session cleared.");
  };

  const submitOrder = async () => {
    if (!restaurant) return;
    if (!cartLines.length) {
      setError("Add at least one dish before placing an order.");
      return;
    }
    if (!customerName.trim() && !tableNumber.trim()) {
      setError("Provide customer name or table number.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await createStorefrontOrder({
        restaurantId: restaurant.id,
        restaurantSlug: restaurant.slug,
        source: "waiter",
        takenByWaiterId: waiterIdentity.id,
        takenByWaiterName: waiterIdentity.name,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        tableNumber: tableNumber.trim() || undefined,
        customerNotes: customerNotes.trim() || undefined,
        createdAt: new Date().toISOString(),
        status: "pending",
        paymentMethod: "manual_mpesa",
        paymentStatus: "unpaid",
        paymentReference: `WAITER-${createPaymentReference()}`,
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
        subtotalAmount: cartTotal,
        totalAmount: cartTotal,
      });

      setCart({});
      setCustomerName("");
      setCustomerPhone("");
      setTableNumber("");
      setCustomerNotes("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      profile={profile}
      title="Staff Desk"
      subtitle="Create table orders fast and monitor your active floor orders."
      actions={
        <Badge variant="accent">
          Active waiter: {waiterIdentity.name}
        </Badge>
      }
    >
      <PageContainer>
      {loading ? (
        <DashboardPanel>
          <div className="space-y-2">
            <div className="h-3 w-48 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-64 animate-pulse rounded bg-white/10" />
          </div>
        </DashboardPanel>
      ) : null}
      {error ? <EmptyStateCard message={error} /> : null}

      {!loading && restaurant ? (
        <ContentGrid className="xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
          <DashboardPanel>
            <SectionHeader
              title="Menu Order Entry"
              subtitle="Browse menu categories, add dishes, and place customer table orders."
            />
            <ActionBar>
              <Input
                id="staff-dish-search"
                name="dishSearch"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search dishes..."
                className="max-w-sm"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={activeCategoryId === "all" ? "primary" : "secondary"}
                  onClick={() => setActiveCategoryId("all")}
                >
                  All
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    size="sm"
                    variant={activeCategoryId === category.id ? "primary" : "secondary"}
                    onClick={() => setActiveCategoryId(category.id)}
                  >
                    {category.name}
                  </Button>
                ))}
              </div>
            </ActionBar>

            <div className="space-y-4">
              {categories.map((category) => {
                const rows = groupedDishes.get(category.id) || [];
                if (!rows.length) return null;
                return (
                  <section key={category.id}>
                    <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-[#E8D8C3]">{category.name}</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {rows.map((dish) => {
                        const qty = cart[dish.id] || 0;
                        return (
                          <article key={dish.id} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-bold text-[#FBF6EE]">{dish.name}</div>
                                <div className="text-xs text-white/60">{dish.description}</div>
                              </div>
                              <div className="text-xs font-bold text-orange-300">{formatKsh(dish.price)}</div>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <Button size="sm" variant="secondary" onClick={() => setDishQty(dish.id, qty - 1)}>
                                -
                              </Button>
                              <span className="min-w-5 text-center text-sm text-white">{qty}</span>
                              <Button size="sm" variant="secondary" onClick={() => setDishQty(dish.id, qty + 1)}>
                                +
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setDishQty(dish.id, qty + 1)}>
                                Add
                              </Button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </DashboardPanel>

          <div className="space-y-4">
            <DashboardPanel>
              <SectionHeader title="Waiter Identity" subtitle="Attach waiter identity to each submitted order." />
              {waiters.length ? (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <UbhonaDropdown
                      id="staff-waiter-code"
                      name="staffWaiterCode"
                      value={selectedWaiterCode}
                      onValueChange={setSelectedWaiterCode}
                      searchable
                      placeholder="Select waiter"
                      items={waiters.map((waiter) => ({
                        value: waiter.code,
                        label: `${waiter.name} (${waiter.code})`,
                        description: waiter.pin ? "PIN protected" : "No PIN",
                      }))}
                    />
                    <Input
                      id="staff-waiter-pin"
                      name="waiterPin"
                      type="password"
                      placeholder="PIN (if configured)"
                      value={waiterPin}
                      onChange={(event) => setWaiterPin(event.target.value)}
                    />
                  </div>
                  <ActionBar className="mt-3 mb-0">
                    <div className="text-xs text-white/70">
                      Session: {waiterSession?.loggedIn ? waiterSession.name : waiterIdentity.name}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={signInWaiter}>Sign In</Button>
                      <Button size="sm" variant="outline" onClick={signOutWaiter}>Clear</Button>
                    </div>
                  </ActionBar>
                </>
              ) : (
                <p className="text-sm text-white/70">
                  No active waiters configured. Orders will attach your current staff identity.
                </p>
              )}
              {waiterMessage ? <p className="mt-2 text-xs text-white/70">{waiterMessage}</p> : null}
            </DashboardPanel>

            <DashboardPanel>
              <SectionHeader title="Customer Details" subtitle="Attach customer or table information before placing the order." />
              <div className="space-y-2">
                <Input
                  id="staff-customer-name"
                  name="customerName"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Customer name"
                />
                <Input
                  id="staff-customer-phone"
                  name="customerPhone"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="Customer phone"
                />
                <Input
                  id="staff-table-number"
                  name="tableNumber"
                  value={tableNumber}
                  onChange={(event) => setTableNumber(event.target.value)}
                  placeholder="Table number"
                />
                <Textarea
                  id="staff-customer-notes"
                  name="customerNotes"
                  value={customerNotes}
                  onChange={(event) => setCustomerNotes(event.target.value)}
                  placeholder="Notes (allergies, special requests, etc.)"
                  rows={3}
                />
              </div>

              {cartLines.length ? (
                <div className="mt-4 space-y-2">
                  {cartLines.map((line) => (
                    <div key={line.dish.id} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-[#FBF6EE]">
                          {line.quantity}x {line.dish.name}
                        </div>
                        <div className="text-xs text-orange-300">{formatKsh(line.subtotal)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3">
                  <EmptyStateCard message="No dishes selected yet." />
                </div>
              )}

              <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                <span className="text-sm text-white/70">Order Total</span>
                <span className="text-lg font-black text-orange-300">{formatKsh(cartTotal)}</span>
              </div>

              <Button
                className="mt-3 w-full"
                variant="primary"
                onClick={() => void submitOrder()}
                disabled={!cartLines.length || saving}
              >
                {saving ? "Submitting..." : "Submit Floor Order"}
              </Button>
            </DashboardPanel>

            <DashboardPanel>
              <SectionHeader title="My Active Orders" subtitle="Open waiter orders currently in progress." />
              {!myActiveOrders.length ? (
                <EmptyStateCard message="No active orders under your waiter identity." />
              ) : (
                <div className="space-y-2">
                  {myActiveOrders.slice(0, 6).map((order) => (
                    <article key={order.id} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="text-xs font-mono text-white/70">{order.id}</div>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="text-sm font-semibold text-[#FBF6EE]">
                        {order.customerName || "Guest"} {order.tableNumber ? ` | Table ${order.tableNumber}` : ""}
                      </div>
                      <div className="text-xs text-white/60">
                        {order.items.length} items | {formatKsh(order.total)} | {new Date(order.createdAt).toLocaleTimeString("en-KE")}
                      </div>
                      {canPrintCustomer ? (
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void printCustomerReceipt(toCustomerPrintOrder(order))}
                          >
                            Print Receipt
                          </Button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </DashboardPanel>
          </div>
        </ContentGrid>
      ) : null}
      </PageContainer>
    </DashboardLayout>
  );
}
