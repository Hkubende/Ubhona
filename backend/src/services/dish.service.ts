import { prisma } from "../prisma.js";

export async function getCategoriesByRestaurant(restaurantId: string) {
  return prisma.category.findMany({
    where: { restaurantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getDishesByRestaurant(restaurantId: string) {
  return prisma.dish.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
  });
}

