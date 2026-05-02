import { describe, expect, it, vi } from "vitest";
import { createRlsAwarePrisma, runWithDbRlsContext, runWithPublicStorefrontDbContext } from "../db-rls.js";

describe("db RLS tenant context", () => {
  it("applies transaction-local session settings before tenant-scoped queries run", async () => {
    const tx = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
      category: {
        findMany: vi.fn().mockResolvedValue([{ id: "cat-1" }]),
      },
    };

    const basePrisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      $executeRaw: vi.fn(),
      $executeRawUnsafe: vi.fn(),
      category: {
        findMany: vi.fn(),
      },
    };

    const prisma = createRlsAwarePrisma(basePrisma as any);

    const rows = await runWithDbRlsContext(
      {
        userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        restaurantId: "11111111-1111-1111-1111-111111111111",
        isAdmin: false,
      },
      () => prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }] })
    );

    expect(basePrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRawUnsafe).toHaveBeenCalledTimes(3);
    expect(tx.$executeRawUnsafe).toHaveBeenNthCalledWith(1, expect.stringContaining("SET LOCAL app.user_id"));
    expect(tx.$executeRawUnsafe).toHaveBeenNthCalledWith(2, expect.stringContaining("SET LOCAL app.restaurant_id"));
    expect(tx.$executeRawUnsafe).toHaveBeenNthCalledWith(3, expect.stringContaining("SET LOCAL app.is_admin"));
    expect(tx.category.findMany).toHaveBeenCalledWith({ orderBy: [{ sortOrder: "asc" }] });
    expect(basePrisma.category.findMany).not.toHaveBeenCalled();
    expect(rows).toEqual([{ id: "cat-1" }]);
  });

  it("fails closed for non-admin queries without restaurant context", async () => {
    const tx = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
      category: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const basePrisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      $executeRaw: vi.fn(),
      $executeRawUnsafe: vi.fn(),
      category: {
        findMany: vi.fn(),
      },
    };

    const prisma = createRlsAwarePrisma(basePrisma as any);

    await expect(
      runWithDbRlsContext(
        {
          userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          isAdmin: false,
        },
        () => prisma.category.findMany({})
      )
    ).rejects.toThrow("Missing app.restaurant_id context before RLS-protected query.");

    expect(basePrisma.$transaction).not.toHaveBeenCalled();
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(tx.category.findMany).not.toHaveBeenCalled();
  });

  it("fails closed when a tenant-protected delegate is accessed without context", async () => {
    const basePrisma = {
      $transaction: vi.fn(),
      $executeRaw: vi.fn(),
      $executeRawUnsafe: vi.fn(),
      category: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const prisma = createRlsAwarePrisma(basePrisma as any);

    await expect(prisma.category.findMany({})).rejects.toThrow(
      "Missing tenant DB context before accessing prisma.category.findMany()."
    );

    expect(basePrisma.$transaction).not.toHaveBeenCalled();
    expect(basePrisma.category.findMany).not.toHaveBeenCalled();
  });

  it("fails closed for raw transaction delegates without a proven tenant context", async () => {
    const tx = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
      category: {
        findMany: vi.fn().mockResolvedValue([{ id: "cat-1" }]),
      },
    };

    const basePrisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      $executeRaw: vi.fn(),
      $executeRawUnsafe: vi.fn(),
      category: {
        findMany: vi.fn(),
      },
    };

    const prisma = createRlsAwarePrisma(basePrisma as any);

    await expect(
      prisma.$transaction(async (txClient: typeof prisma) => txClient.category.findMany({}))
    ).rejects.toThrow("Missing app.user_id context before RLS-protected query.");

    expect(tx.category.findMany).not.toHaveBeenCalled();
  });

  it("applies a synthetic anonymous user for public storefront reads", async () => {
    const tx = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
      category: {
        findMany: vi.fn().mockResolvedValue([{ id: "cat-1" }]),
      },
    };

    const basePrisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      $executeRaw: vi.fn(),
      $executeRawUnsafe: vi.fn(),
      category: {
        findMany: vi.fn(),
      },
    };

    const prisma = createRlsAwarePrisma(basePrisma as any);

    await runWithPublicStorefrontDbContext("11111111-1111-1111-1111-111111111111", () =>
      prisma.category.findMany({ where: { restaurantId: "11111111-1111-1111-1111-111111111111" } })
    );

    expect(basePrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRawUnsafe).toHaveBeenCalledTimes(3);
  });
});
