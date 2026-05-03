import { AsyncLocalStorage } from "node:async_hooks";

const ADMIN_SENTINEL_RESTAURANT_ID = "00000000-0000-0000-0000-000000000000";
const PUBLIC_STOREFRONT_USER_ID = "00000000-0000-0000-0000-000000000001";
export const PAYMENT_CALLBACK_SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000002";

export type DbRlsContext = {
  userId?: string;
  restaurantId?: string;
  isAdmin: boolean;
  tx?: Record<string, unknown>;
};

type PrismaMethod = (...args: unknown[]) => Promise<unknown>;

type PrismaLike = Record<string, unknown> & {
  $transaction: PrismaMethod;
  $executeRaw: PrismaMethod;
  $executeRawUnsafe: PrismaMethod;
};

const tenantProtectedDelegates = new Set([
  "category",
  "dish",
  "order",
  "orderItem",
  "payment",
  "uploadAsset",
  "analyticsEvent",
  "platformTrackerDocument",
]);

const dbRlsContextStorage = new AsyncLocalStorage<DbRlsContext>();

export function runWithDbRlsContext<T>(context: DbRlsContext, callback: () => T): T {
  return dbRlsContextStorage.run(context, callback);
}

export function runWithPublicStorefrontDbContext<T>(restaurantId: string, callback: () => T): T {
  // Anonymous storefront traffic still needs explicit DB session values once
  // live RLS is enforced. Use a synthetic public user UUID plus the resolved
  // restaurant tenant UUID so reads stay tenant-bound without leaking auth
  // context across pooled connections.
  return runWithDbRlsContext(
    {
      userId: PUBLIC_STOREFRONT_USER_ID,
      restaurantId,
      isAdmin: false,
    },
    callback
  );
}

export function runWithPaymentCallbackResolutionDbContext<T>(
  input: { actorIdentifier: string },
  callback: () => T
): T {
  const { actorIdentifier } = input;
  void actorIdentifier;

  // Provider callbacks arrive without an authenticated tenant user. Before the
  // tenant can be bound, resolve only the unique internal payment linkage under
  // a fixed synthetic system principal with app.is_admin=true. This uses the
  // explicit admin policy path instead of a privileged database role.
  return runWithDbRlsContext(
    {
      userId: PAYMENT_CALLBACK_SYSTEM_USER_ID,
      isAdmin: true,
    },
    callback
  );
}

export function runWithPaymentCallbackDbContext<T>(
  input: { restaurantId: string; actorIdentifier: string },
  callback: () => T
): T {
  const { restaurantId, actorIdentifier } = input;
  void actorIdentifier;

  // Once the callback's payment linkage resolves a trusted tenant, drop back to
  // a tenant-bound non-admin session so subsequent writes respect the same RLS
  // tenant filters as normal application traffic.
  return runWithDbRlsContext(
    {
      userId: PAYMENT_CALLBACK_SYSTEM_USER_ID,
      restaurantId,
      isAdmin: false,
    },
    callback
  );
}

export function getDbRlsContext() {
  return dbRlsContextStorage.getStore();
}

function resolveContextForQuery(context: DbRlsContext) {
  if (!context.userId) {
    throw new Error("Missing app.user_id context before RLS-protected query.");
  }

  if (!context.isAdmin && !context.restaurantId) {
    throw new Error("Missing app.restaurant_id context before RLS-protected query.");
  }

  return {
    userId: context.userId,
    restaurantId: context.restaurantId ?? ADMIN_SENTINEL_RESTAURANT_ID,
    isAdmin: context.isAdmin,
  };
}

function toSqlLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function applyDbRlsSession(client: PrismaLike, context: DbRlsContext) {
  const resolved = resolveContextForQuery(context);

  // Use SET LOCAL inside the active transaction so pooled connections do not
  // leak auth or tenant state across requests. PostgreSQL resets these values
  // automatically at transaction end, which is why every protected query must
  // execute on the same transaction connection.
  await client.$executeRawUnsafe(`SET LOCAL app.user_id = ${toSqlLiteral(resolved.userId)}`);
  await client.$executeRawUnsafe(`SET LOCAL app.restaurant_id = ${toSqlLiteral(resolved.restaurantId)}`);
  await client.$executeRawUnsafe(`SET LOCAL app.is_admin = ${toSqlLiteral(resolved.isAdmin ? "true" : "false")}`);
}

function resolvePath(target: Record<string, unknown>, path: string[]) {
  return path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, target);
}

function createDelegateProxy(basePrisma: PrismaLike, path: string[]): PrismaLike {
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property !== "string") {
          return undefined;
        }

        if (path.length === 0 && property === "$transaction") {
          return async (...args: unknown[]) => {
            if (typeof args[0] !== "function") {
              return basePrisma.$transaction(...args);
            }

            const callback = args[0] as (tx: PrismaLike) => Promise<unknown>;
            const options = args[1];
            const context = getDbRlsContext();

            return basePrisma.$transaction(async (tx: PrismaLike) => {
              if (context) {
                await applyDbRlsSession(tx as PrismaLike, context);
              }

              const txProxy = createDelegateProxy(tx as PrismaLike, []);
              return runWithDbRlsContext(
                context ? { ...context, tx } : { isAdmin: false, tx },
                () => callback(txProxy)
              );
            }, options);
          };
        }

        const activeContext = getDbRlsContext();
        const activeRoot = (activeContext?.tx as PrismaLike | undefined) ?? basePrisma;
        const value = resolvePath(activeRoot, [...path, property]);

        if (typeof value === "function") {
          return async (...args: unknown[]) => {
            const currentContext = getDbRlsContext();
            const activeDelegate = path[0];
            const isTenantProtected = Boolean(activeDelegate && tenantProtectedDelegates.has(activeDelegate));

            if (isTenantProtected) {
              if (!currentContext) {
                throw new Error(
                  `Missing tenant DB context before accessing prisma.${activeDelegate}.${property}(). Use runWithTenantContext or an equivalent RLS-bound context wrapper.`
                );
              }
              resolveContextForQuery(currentContext);
            }

            if (currentContext?.tx) {
              return value.apply(resolvePath(currentContext.tx as Record<string, unknown>, path), args);
            }

            if (
              !currentContext ||
              property === "$connect" ||
              property === "$disconnect" ||
              property === "$on" ||
              property === "$use" ||
              property === "$extends"
            ) {
              return value.apply(resolvePath(basePrisma, path), args);
            }

            return basePrisma.$transaction(async (tx: PrismaLike) => {
              await applyDbRlsSession(tx as PrismaLike, currentContext);
              const delegate = resolvePath(tx as Record<string, unknown>, path);
              const method =
                delegate && typeof delegate === "object"
                  ? (delegate as Record<string, unknown>)[property]
                  : undefined;
              if (typeof method !== "function") {
                throw new Error(`Missing prisma delegate method for ${[...path, property].join(".")}.`);
              }
              return runWithDbRlsContext({ ...currentContext, tx }, () => method.apply(delegate, args));
            });
          };
        }

        if (value && typeof value === "object") {
          return createDelegateProxy(basePrisma, [...path, property]);
        }

        return value;
      },
    }
  );
}

export function createRlsAwarePrisma<T extends PrismaLike>(basePrisma: T): T {
  return createDelegateProxy(basePrisma, []) as T;
}
