import { getAnalyticsSummary as loadAnalyticsSummary, getAnalyticsTopDishes } from "./analytics";
import { getCategories as fetchCategories, type RestaurantCategory } from "./categories";
import {
  loadOrders,
  updateOrderStatus,
  type Order as SourceOrder,
  type OrderStatus as SourceOrderStatus,
} from "./orders";
import {
  getRestaurantDishes as fetchRestaurantDishes,
  type RestaurantDish,
} from "./restaurant-dishes";
import {
  canUseFeature,
  getRestaurantBranding,
  getRestaurantProfile,
  syncRestaurantProfile,
  type RestaurantProfile,
} from "./restaurant";
import type {
  AnalyticsSummary,
  BrandingSettings,
  Category,
  Dish,
  Order,
  OrderStatus,
  PopularDish,
  Restaurant,
  RestaurantDashboardData,
} from "../types/dashboard";

const DEFAULT_RESTAURANT_ID = "local_default_restaurant";
const dashboardDataRequests = new Map<string, Promise<RestaurantDashboardData>>();
const CATEGORIES_CACHE_KEY = "mv_restaurant_categories_v1";
const DISHES_CACHE_KEY = "mv_restaurant_dishes_v1";
const ORDERS_CACHE_KEY = "mv_orders_v1";
const LEGACY_BUCKET = "__legacy__";

const MOCK_RESTAURANT: Restaurant = {
  id: DEFAULT_RESTAURANT_ID,
  name: "Ubhona Demo Kitchen",
  slug: "ubhona-demo",
  email: "demo@ubhona.com",
  phone: "+254700000000",
  location: "Nairobi",
  subscriptionPlan: "starter",
  subscriptionStatus: "active",
  logoUrl: `${import.meta.env.BASE_URL}ubhona-logo.jpeg`,
  coverImageUrl: "",
  primaryColor: "#FF6A1A",
  description: "Visualize",
  onboardingCompleted: true,
};

const MOCK_CATEGORIES: Category[] = [
  { id: "cat-specials", restaurantId: DEFAULT_RESTAURANT_ID, name: "Specials", sortOrder: 0 },
  { id: "cat-burgers", restaurantId: DEFAULT_RESTAURANT_ID, name: "Burgers", sortOrder: 1 },
  { id: "cat-drinks", restaurantId: DEFAULT_RESTAURANT_ID, name: "Drinks", sortOrder: 2 },
];

const MOCK_DISHES: Dish[] = [
  {
    id: "dish-signature-burger",
    restaurantId: DEFAULT_RESTAURANT_ID,
    categoryId: "cat-burgers",
    name: "Signature Burger",
    description: "House sauce, pickled onion, double patty.",
    price: 1200,
    imageUrl: "",
    modelUrl: "",
    available: true,
    popularityCount: 47,
  },
  {
    id: "dish-chicken-combo",
    restaurantId: DEFAULT_RESTAURANT_ID,
    categoryId: "cat-specials",
    name: "Roasted Chicken Combo",
    description: "Roasted chicken served with fries and dip.",
    price: 1500,
    imageUrl: "",
    modelUrl: "",
    available: true,
    popularityCount: 31,
  },
  {
    id: "dish-root-beer",
    restaurantId: DEFAULT_RESTAURANT_ID,
    categoryId: "cat-drinks",
    name: "Root Beer",
    description: "Chilled bottle, restaurant favorite.",
    price: 350,
    imageUrl: "",
    modelUrl: "",
    available: true,
    popularityCount: 24,
  },
];

const MOCK_ORDERS: Order[] = [
  {
    id: "demo-order-001",
    restaurantId: DEFAULT_RESTAURANT_ID,
    customerName: "Walk-in Guest",
    customerPhone: "+254700111222",
    items: [
      { dishId: "dish-signature-burger", name: "Signature Burger", quantity: 1, unitPrice: 1200, totalPrice: 1200 },
    ],
    subtotal: 1200,
    total: 1200,
    status: "ready",
    createdAt: new Date().toISOString(),
  },
];

function isTodayIso(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function toDashboardRestaurant(profile: RestaurantProfile | null): Restaurant {
  if (!profile) return MOCK_RESTAURANT;
  return {
    id: profile.id || DEFAULT_RESTAURANT_ID,
    name: profile.restaurantName || "Ubhona Restaurant",
    slug: profile.slug || "restaurant",
    email: profile.email || "",
    phone: profile.phone || "",
    location: profile.location || "",
    subscriptionPlan: profile.subscriptionPlan,
    subscriptionStatus: profile.subscriptionStatus,
    logoUrl: profile.logo || undefined,
    coverImageUrl: profile.coverImage || undefined,
    primaryColor: profile.themePrimary || "#FF6A1A",
    description: profile.shortDescription || "Visualize",
    onboardingCompleted: Boolean(profile.restaurantName && profile.slug && profile.email),
  };
}

function toDashboardCategory(category: RestaurantCategory): Category {
  return {
    id: category.id,
    restaurantId: category.restaurantId,
    name: category.name,
    sortOrder: category.sortOrder,
  };
}

function toDashboardDish(dish: RestaurantDish): Dish {
  return {
    id: dish.id,
    restaurantId: dish.restaurantId,
    categoryId: dish.categoryId,
    name: dish.name,
    description: dish.desc,
    price: dish.price,
    imageUrl: dish.thumb || undefined,
    modelUrl: dish.model || undefined,
    available: dish.isAvailable,
  };
}

function toDashboardOrder(order: SourceOrder, fallbackRestaurantId: string): Order {
  const items = order.items.map((item) => ({
    dishId: item.dishId,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.subtotal,
  }));
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  return {
    id: order.id,
    restaurantId: order.restaurantId || fallbackRestaurantId,
    customerName: order.customerName || "Guest",
    customerPhone: order.customerPhone || "",
    tableNumber: order.tableNumber || undefined,
    customerNotes: order.customerNotes || undefined,
    items,
    subtotal,
    total: Number.isFinite(order.total) ? order.total : subtotal,
    status: order.status as OrderStatus,
    paymentStatus: order.paymentStatus || undefined,
    paymentMethod: order.paymentMethod || undefined,
    paymentReference: order.paymentReference || undefined,
    transactionId: order.paymentReference || undefined,
    source: order.source || "customer",
    takenByWaiterId: order.takenByWaiterId || undefined,
    takenByWaiterName: order.takenByWaiterName || undefined,
    createdAt: order.createdAt,
  };
}

function mapOrderStatus(status: OrderStatus): SourceOrderStatus {
  return status;
}

function safeRestaurantId(restaurantId?: string | null) {
  return String(restaurantId || "").trim() || DEFAULT_RESTAURANT_ID;
}

function readScopedArrayCache<T extends { restaurantId?: string }>(storageKey: string, restaurantId: string): T[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (Array.isArray(parsed)) {
      return parsed
        .filter((row): row is T => !!row && typeof row === "object")
        .filter((row) => safeRestaurantId(row.restaurantId) === restaurantId);
    }
    if (!parsed || typeof parsed !== "object") return [];
    const record = parsed as Record<string, unknown>;
    const direct = record[restaurantId];
    if (Array.isArray(direct)) {
      return direct.filter((row): row is T => !!row && typeof row === "object");
    }
    const legacy = record[LEGACY_BUCKET];
    if (Array.isArray(legacy)) {
      return legacy
        .filter((row): row is T => !!row && typeof row === "object")
        .filter((row) => safeRestaurantId(row.restaurantId) === restaurantId);
    }
    return [];
  } catch {
    return [];
  }
}

function readScopedOrdersCache(restaurantId: string): SourceOrder[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ORDERS_CACHE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is SourceOrder => !!row && typeof row === "object")
      .filter((row) => safeRestaurantId(row.restaurantId) === restaurantId);
  } catch {
    return [];
  }
}

function buildCachedPopularDishes(dishes: Dish[], orders: Order[]): PopularDish[] {
  const counts = new Map<string, { dishId: string; name: string; count: number; revenue?: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const current = counts.get(item.dishId) || {
        dishId: item.dishId,
        name: item.name,
        count: 0,
        revenue: 0,
      };
      current.count += item.quantity;
      current.revenue = (current.revenue || 0) + item.totalPrice;
      counts.set(item.dishId, current);
    }
  }
  if (counts.size) {
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  }
  return dishes
    .filter((dish) => typeof dish.popularityCount === "number")
    .map((dish) => ({
      dishId: dish.id,
      name: dish.name,
      count: dish.popularityCount || 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export async function getActiveRestaurantId() {
  const synced = await syncRestaurantProfile();
  return safeRestaurantId(synced?.id || getRestaurantProfile()?.id);
}

export async function getDashboardRestaurant(restaurantId: string): Promise<Restaurant> {
  const scopedRestaurantId = safeRestaurantId(restaurantId);
  const synced = await syncRestaurantProfile();
  const mapped = toDashboardRestaurant(synced || getRestaurantProfile());
  if (mapped.id === scopedRestaurantId) return mapped;
  if (scopedRestaurantId === DEFAULT_RESTAURANT_ID) return MOCK_RESTAURANT;
  return {
    ...MOCK_RESTAURANT,
    id: scopedRestaurantId,
    slug: `${MOCK_RESTAURANT.slug}-${scopedRestaurantId.slice(0, 6)}`,
  };
}

export async function getCategories(restaurantId: string): Promise<Category[]> {
  const scopedRestaurantId = safeRestaurantId(restaurantId);
  const categories = await fetchCategories();
  const scoped = categories.filter((item) => item.restaurantId === scopedRestaurantId).map(toDashboardCategory);
  return scoped.length ? scoped : scopedRestaurantId === DEFAULT_RESTAURANT_ID ? MOCK_CATEGORIES : [];
}

export async function getDishes(restaurantId: string): Promise<Dish[]> {
  const scopedRestaurantId = safeRestaurantId(restaurantId);
  const dishes = await fetchRestaurantDishes();
  const scoped = dishes.filter((item) => item.restaurantId === scopedRestaurantId).map(toDashboardDish);
  return scoped.length ? scoped : scopedRestaurantId === DEFAULT_RESTAURANT_ID ? MOCK_DISHES : [];
}

export async function getOrders(restaurantId: string): Promise<Order[]> {
  const scopedRestaurantId = safeRestaurantId(restaurantId);
  const orders = await loadOrders({ restaurantId: scopedRestaurantId });
  const scoped = orders.map((order) => toDashboardOrder(order, scopedRestaurantId));
  return scoped.length ? scoped : scopedRestaurantId === DEFAULT_RESTAURANT_ID ? MOCK_ORDERS : [];
}

export async function getRecentOrders(restaurantId: string, limit = 5): Promise<Order[]> {
  const rows = await getOrders(restaurantId);
  return rows
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, Math.max(0, Math.floor(limit)));
}

export async function getPopularDishes(restaurantId: string, limit = 5): Promise<PopularDish[]> {
  const scopedRestaurantId = safeRestaurantId(restaurantId);
  const top = await getAnalyticsTopDishes(30, scopedRestaurantId);
  const ordered = top.mostOrderedDishes
    .map((dish) => ({
      dishId: dish.dishId,
      name: dish.name,
      count: dish.quantity,
      revenue: dish.revenue,
    }))
    .filter((dish) => dish.dishId);
  if (ordered.length) return ordered.slice(0, Math.max(0, Math.floor(limit)));

  const dishes = await getDishes(scopedRestaurantId);
  return dishes
    .filter((dish) => typeof dish.popularityCount === "number")
    .map((dish) => ({
      dishId: dish.id,
      name: dish.name,
      count: dish.popularityCount || 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.max(0, Math.floor(limit)));
}

export async function getBrandingSettings(restaurantId: string): Promise<BrandingSettings> {
  const scopedRestaurantId = safeRestaurantId(restaurantId);
  const restaurant = await getDashboardRestaurant(scopedRestaurantId);
  const profile = getRestaurantProfile();
  const branding = getRestaurantBranding(profile);
  return {
    logoUrl: restaurant.logoUrl || branding.logoUrl,
    coverImageUrl: restaurant.coverImageUrl || branding.coverImageUrl || "",
    primaryColor: restaurant.primaryColor || branding.primary,
    description: restaurant.description || branding.shortDescription,
  };
}

export async function getAnalyticsSummary(restaurantId: string): Promise<AnalyticsSummary> {
  const scopedRestaurantId = safeRestaurantId(restaurantId);
  const [dishes, orders, analytics, popularDishes, recentOrders] = await Promise.all([
    getDishes(scopedRestaurantId),
    getOrders(scopedRestaurantId),
    loadAnalyticsSummary(30, scopedRestaurantId),
    getPopularDishes(scopedRestaurantId, 5),
    getRecentOrders(scopedRestaurantId, 5),
  ]);

  const ordersToday = orders.filter((order) => isTodayIso(order.createdAt)).length;
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);
  const totalOrdersPlaced = Math.max(analytics.totals.orderPlacedCount, orders.length);

  return {
    totalDishes: dishes.length,
    totalDishViews: analytics.totals.dishViewCount,
    totalAddToCart: analytics.totals.addToCartCount,
    totalOrdersPlaced,
    ordersToday,
    arOpens: analytics.totals.arOpenCount,
    revenue,
    popularDishes,
    recentOrders,
  };
}

export function getCachedRestaurantDashboardData(restaurantId: string): RestaurantDashboardData | null {
  const scopedRestaurantId = safeRestaurantId(restaurantId);
  const resolvedProfile = getRestaurantProfile();
  const restaurant = toDashboardRestaurant(resolvedProfile);
  const branding = getRestaurantBranding(resolvedProfile);
  const categoryRows = readScopedArrayCache<RestaurantCategory>(CATEGORIES_CACHE_KEY, scopedRestaurantId);
  const dishRows = readScopedArrayCache<RestaurantDish>(DISHES_CACHE_KEY, scopedRestaurantId);
  const orderRows = readScopedOrdersCache(scopedRestaurantId);

  const categories = categoryRows.map(toDashboardCategory);
  const dishes = dishRows.map(toDashboardDish);
  const orders = orderRows.map((order) => toDashboardOrder(order, scopedRestaurantId));
  const recentOrders = orders
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);
  const fallbackRestaurant =
    scopedRestaurantId === DEFAULT_RESTAURANT_ID
      ? MOCK_RESTAURANT
      : {
          ...MOCK_RESTAURANT,
          id: scopedRestaurantId,
          slug: `${MOCK_RESTAURANT.slug}-${scopedRestaurantId.slice(0, 6)}`,
        };

  if (!resolvedProfile && !categories.length && !dishes.length && !orders.length && scopedRestaurantId !== DEFAULT_RESTAURANT_ID) {
    return null;
  }

  return {
    restaurant: restaurant.id === scopedRestaurantId ? restaurant : fallbackRestaurant,
    categories: categories.length ? categories : scopedRestaurantId === DEFAULT_RESTAURANT_ID ? MOCK_CATEGORIES : [],
    dishes: dishes.length ? dishes : scopedRestaurantId === DEFAULT_RESTAURANT_ID ? MOCK_DISHES : [],
    orders: orders.length ? orders : scopedRestaurantId === DEFAULT_RESTAURANT_ID ? MOCK_ORDERS : [],
    analyticsSummary: {
      totalDishes: dishes.length,
      totalDishViews: 0,
      totalAddToCart: 0,
      totalOrdersPlaced: orders.length,
      ordersToday: orders.filter((order) => isTodayIso(order.createdAt)).length,
      arOpens: 0,
      revenue,
      popularDishes: buildCachedPopularDishes(dishes, orders),
      recentOrders,
    },
    brandingSettings: {
      logoUrl: restaurant.logoUrl || branding.logoUrl,
      coverImageUrl: restaurant.coverImageUrl || branding.coverImageUrl || "",
      primaryColor: restaurant.primaryColor || branding.primary,
      description: restaurant.description || branding.shortDescription,
    },
  };
}

export async function getRestaurantDashboardData(restaurantId: string): Promise<RestaurantDashboardData> {
  const scopedRestaurantId = safeRestaurantId(restaurantId);
  const existingRequest = dashboardDataRequests.get(scopedRestaurantId);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const syncedProfile = await syncRestaurantProfile();
    const resolvedProfile = syncedProfile || getRestaurantProfile();
    const restaurant = toDashboardRestaurant(resolvedProfile);
    const branding = getRestaurantBranding(resolvedProfile);
    const analyticsEnabled = canUseFeature("analytics", resolvedProfile);
    const [categoryRows, dishRows, orderRows, analytics, topDishes] = await Promise.all([
      fetchCategories(),
      fetchRestaurantDishes(),
      loadOrders({ restaurantId: scopedRestaurantId }),
      analyticsEnabled
        ? loadAnalyticsSummary(30, scopedRestaurantId)
        : Promise.resolve({
            periodDays: 30,
            totals: {
              pageViewCount: 0,
              dishViewCount: 0,
              arOpenCount: 0,
              addToCartCount: 0,
              checkoutStartCount: 0,
              orderPlacedCount: 0,
            },
            rates: {
              arEngagementRate: 0,
              addToCartRate: 0,
              checkoutStartRate: 0,
              orderConversionRate: 0,
            },
            mostViewedDishes: [],
            mostOrderedDishes: [],
          }),
      analyticsEnabled
        ? getAnalyticsTopDishes(30, scopedRestaurantId)
        : Promise.resolve({
            periodDays: 30,
            mostViewedDishes: [],
            mostOrderedDishes: [],
          }),
    ]);
    const categories = categoryRows
      .filter((item) => item.restaurantId === scopedRestaurantId)
      .map(toDashboardCategory);
    const dishes = dishRows.filter((item) => item.restaurantId === scopedRestaurantId).map(toDashboardDish);
    const orders = orderRows.map((order) => toDashboardOrder(order, scopedRestaurantId));
    const popularDishes = topDishes.mostOrderedDishes
      .map((dish) => ({
        dishId: dish.dishId,
        name: dish.name,
        count: dish.quantity,
        revenue: dish.revenue,
      }))
      .filter((dish) => dish.dishId)
      .slice(0, 5);
    const recentOrders = orders
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);

    return {
      restaurant:
        restaurant.id === scopedRestaurantId
          ? restaurant
          : scopedRestaurantId === DEFAULT_RESTAURANT_ID
            ? MOCK_RESTAURANT
            : {
                ...MOCK_RESTAURANT,
                id: scopedRestaurantId,
                slug: `${MOCK_RESTAURANT.slug}-${scopedRestaurantId.slice(0, 6)}`,
              },
      categories: categories.length ? categories : scopedRestaurantId === DEFAULT_RESTAURANT_ID ? MOCK_CATEGORIES : [],
      dishes: dishes.length ? dishes : scopedRestaurantId === DEFAULT_RESTAURANT_ID ? MOCK_DISHES : [],
      orders: orders.length ? orders : scopedRestaurantId === DEFAULT_RESTAURANT_ID ? MOCK_ORDERS : [],
      analyticsSummary: {
        totalDishes: dishes.length,
        totalDishViews: analytics.totals.dishViewCount,
        totalAddToCart: analytics.totals.addToCartCount,
        totalOrdersPlaced: Math.max(analytics.totals.orderPlacedCount, orders.length),
        ordersToday: orders.filter((order) => isTodayIso(order.createdAt)).length,
        arOpens: analytics.totals.arOpenCount,
        revenue: orders.reduce((sum, order) => sum + order.total, 0),
        popularDishes: popularDishes.length
          ? popularDishes
          : dishes
              .filter((dish) => typeof dish.popularityCount === "number")
              .map((dish) => ({
                dishId: dish.id,
                name: dish.name,
                count: dish.popularityCount || 0,
              }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 5),
        recentOrders,
      },
      brandingSettings: {
        logoUrl: restaurant.logoUrl || branding.logoUrl,
        coverImageUrl: restaurant.coverImageUrl || branding.coverImageUrl || "",
        primaryColor: restaurant.primaryColor || branding.primary,
        description: restaurant.description || branding.shortDescription,
      },
    };
  })().finally(() => {
    dashboardDataRequests.delete(scopedRestaurantId);
  });

  dashboardDataRequests.set(scopedRestaurantId, request);
  return request;
}

export async function setOrderStatus(restaurantId: string, orderId: string, status: OrderStatus) {
  const scopedRestaurantId = safeRestaurantId(restaurantId);
  await updateOrderStatus(orderId, mapOrderStatus(status), { restaurantId: scopedRestaurantId });
  return getOrders(scopedRestaurantId);
}
