export type Restaurant = {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  location: string;
  subscriptionPlan?: "starter" | "pro" | "enterprise";
  subscriptionStatus?: "trialing" | "active" | "past_due" | "canceled" | "suspended";
  logoUrl?: string;
  coverImageUrl?: string;
  primaryColor?: string;
  description?: string;
  onboardingCompleted: boolean;
};

export type Category = {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
};

export type Dish = {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  modelUrl?: string;
  available: boolean;
  popularityCount?: number;
};

export type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "completed";

export type OrderItem = {
  dishId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type Order = {
  id: string;
  restaurantId: string;
  customerName: string;
  customerPhone: string;
  tableNumber?: string;
  customerNotes?: string;
  source?: "customer" | "admin" | "waiter";
  takenByWaiterId?: string;
  takenByWaiterName?: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  status: OrderStatus;
  paymentStatus?: string;
  paymentMethod?: "manual_mpesa" | "stk_push";
  paymentReference?: string;
  transactionId?: string;
  createdAt: string;
};

export type PopularDish = {
  dishId: string;
  name: string;
  count: number;
  revenue?: number;
};

export type AnalyticsSummary = {
  totalDishes: number;
  totalDishViews: number;
  totalAddToCart: number;
  totalOrdersPlaced: number;
  ordersToday: number;
  arOpens: number;
  revenue: number;
  popularDishes: PopularDish[];
  recentOrders: Order[];
};

export type BrandingSettings = {
  logoUrl: string;
  coverImageUrl: string;
  primaryColor: string;
  description: string;
};

export type RestaurantDashboardData = {
  restaurant: Restaurant;
  categories: Category[];
  dishes: Dish[];
  orders: Order[];
  analyticsSummary: AnalyticsSummary;
  brandingSettings: BrandingSettings;
};
