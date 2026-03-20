import { getAnalyticsSummary as fetchAnalyticsSummary, getAnalyticsTopDishes } from "./analytics";
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
  primaryColor: "#E4572E",
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
    primaryColor: profile.themePrimary || "#E4572E",
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
    fetchAnalyticsSummary(30, scopedRestaurantId),
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

export async function getRestaurantDashboardData(restaurantId: string): Promise<RestaurantDashboardData> {
  const scopedRestaurantId = safeRestaurantId(restaurantId);
  const [restaurant, categories, dishes, orders, analyticsSummary, brandingSettings] = await Promise.all([
    getDashboardRestaurant(scopedRestaurantId),
    getCategories(scopedRestaurantId),
    getDishes(scopedRestaurantId),
    getOrders(scopedRestaurantId),
    getAnalyticsSummary(scopedRestaurantId),
    getBrandingSettings(scopedRestaurantId),
  ]);

  return {
    restaurant,
    categories,
    dishes,
    orders,
    analyticsSummary,
    brandingSettings,
  };
}

export async function setOrderStatus(restaurantId: string, orderId: string, status: OrderStatus) {
  const scopedRestaurantId = safeRestaurantId(restaurantId);
  await updateOrderStatus(orderId, mapOrderStatus(status), { restaurantId: scopedRestaurantId });
  return getOrders(scopedRestaurantId);
}
