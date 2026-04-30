import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

export async function runWithRestaurantDbSession<T>(
  input: { userId: string; restaurantId: string; isAdmin: boolean },
  callback: (tx: Prisma.TransactionClient) => Promise<T>
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${input.userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.restaurant_id', ${input.restaurantId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.is_admin', ${input.isAdmin ? "true" : "false"}, true)`;
    return callback(tx);
  });
}
