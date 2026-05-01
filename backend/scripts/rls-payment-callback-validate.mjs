import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  assertRuntimeValidationEvidence,
  collectRlsRoleEvidence,
  createClient,
  resolveRlsDatabaseUrl,
} from "./rls-connection-contract.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const { envName, value: appRuntimeDatabaseUrl } = resolveRlsDatabaseUrl("validate");
process.env.DATABASE_URL = appRuntimeDatabaseUrl;
process.env.APP_RUNTIME_DATABASE_URL = appRuntimeDatabaseUrl;

const TENANT_USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const DEFAULT_CONFLICT_HINT_RESTAURANT_ID = "22222222-2222-4222-8222-222222222222";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function loadBuiltBackendModule(relativePath) {
  const absolutePath = path.resolve(scriptDir, "..", "dist", relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing built backend artifact ${absolutePath}. Run npm --prefix backend run build first.`);
  }
  return import(pathToFileURL(absolutePath).href);
}

async function assertRuntimeRoleIsAppSafe(connectionString) {
  const client = await createClient(connectionString);
  try {
    const evidence = await collectRlsRoleEvidence(client, {
      mode: "validate",
      envName,
      connectionString,
    });
    console.log("Payment callback RLS role audit evidence:", JSON.stringify(evidence, null, 2));
    assertRuntimeValidationEvidence(evidence, {
      contextLabel: "Payment callback live validation",
    });
  } finally {
    await client.end();
  }
}

function buildProbeIds() {
  const suffix = Date.now().toString(36);
  return {
    trustedOrderId: `cb-order-trusted-${suffix}`,
    trustedPaymentId: `cb-payment-trusted-${suffix}`,
    trustedCheckoutRequestId: `cb-checkout-trusted-${suffix}`,
    conflictOrderId: `cb-order-conflict-${suffix}`,
    conflictPaymentId: `cb-payment-conflict-${suffix}`,
    conflictCheckoutRequestId: `cb-checkout-conflict-${suffix}`,
    missingCheckoutRequestId: `cb-checkout-missing-${suffix}`,
  };
}

async function resolveProbeRestaurantId(prisma, runWithPaymentCallbackResolutionDbContext, actorIdentifier) {
  const restaurant = await runWithPaymentCallbackResolutionDbContext({ actorIdentifier }, () =>
    prisma.restaurant.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })
  );

  if (!restaurant?.id) {
    throw new Error("Live callback validation requires at least one existing restaurant row.");
  }

  return restaurant.id;
}

async function main() {
  await assertRuntimeRoleIsAppSafe(appRuntimeDatabaseUrl);

  const [{ prisma, runWithTenantContext }, { runWithPaymentCallbackResolutionDbContext }, { handleStkCallback }] =
    await Promise.all([
      loadBuiltBackendModule("prisma.js"),
      loadBuiltBackendModule("db-rls.js"),
      loadBuiltBackendModule("services/payment.service.js"),
    ]);

  const ids = buildProbeIds();
  const probeRestaurantId = await resolveProbeRestaurantId(
    prisma,
    runWithPaymentCallbackResolutionDbContext,
    ids.trustedCheckoutRequestId
  );
  const conflictingHintRestaurantId =
    probeRestaurantId === DEFAULT_CONFLICT_HINT_RESTAURANT_ID
      ? "33333333-3333-4333-8333-333333333333"
      : DEFAULT_CONFLICT_HINT_RESTAURANT_ID;

  try {
    await runWithTenantContext({
      restaurantId: probeRestaurantId,
      userId: TENANT_USER_ID,
      isAdmin: false,
      fn: async (tx) => {
        await tx.order.create({
          data: {
            id: ids.trustedOrderId,
            restaurantId: probeRestaurantId,
            customerName: "RLS Callback Probe",
            customerPhone: "254700000001",
            totalAmount: 101,
            paymentStatus: "processing",
            paymentMethod: "stk_push",
            paymentReference: ids.trustedCheckoutRequestId,
            status: "pending",
          },
        });

        await tx.payment.create({
          data: {
            id: ids.trustedPaymentId,
            restaurantId: probeRestaurantId,
            orderId: ids.trustedOrderId,
            provider: "mpesa",
            phone: "254700000001",
            amount: 101,
            status: "processing",
            checkoutRequestId: ids.trustedCheckoutRequestId,
            merchantRequestId: `merchant-${ids.trustedCheckoutRequestId}`,
            resultCode: 0,
            resultDesc: "Awaiting callback",
            requestPayload: { probe: true, type: "trusted" },
          },
        });

        await tx.order.create({
          data: {
            id: ids.conflictOrderId,
            restaurantId: probeRestaurantId,
            customerName: "RLS Callback Conflict Probe",
            customerPhone: "254700000002",
            totalAmount: 102,
            paymentStatus: "processing",
            paymentMethod: "stk_push",
            paymentReference: ids.conflictCheckoutRequestId,
            status: "pending",
          },
        });

        await tx.payment.create({
          data: {
            id: ids.conflictPaymentId,
            restaurantId: probeRestaurantId,
            orderId: ids.conflictOrderId,
            provider: "mpesa",
            phone: "254700000002",
            amount: 102,
            status: "processing",
            checkoutRequestId: ids.conflictCheckoutRequestId,
            merchantRequestId: `merchant-${ids.conflictCheckoutRequestId}`,
            resultCode: 0,
            resultDesc: "Awaiting callback",
            requestPayload: { probe: true, type: "conflict" },
          },
        });
      },
    });

    const trustedResult = await handleStkCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: ids.trustedCheckoutRequestId,
          ResultCode: 0,
          ResultDesc: "The service request is processed successfully.",
          CallbackMetadata: {
            Item: [{ Name: "MpesaReceiptNumber", Value: `RLS-${Date.now()}` }],
          },
        },
      },
    });

    assert(trustedResult.ignored === false, "Trusted callback did not process successfully.");

    await sleep(1200);

    const trustedState = await runWithTenantContext({
      restaurantId: probeRestaurantId,
      userId: TENANT_USER_ID,
      isAdmin: false,
      fn: async (tx) => {
        const [order, payment, analyticsEvent] = await Promise.all([
          tx.order.findUnique({
            where: { id: ids.trustedOrderId },
            select: {
              id: true,
              status: true,
              paymentStatus: true,
              paymentReference: true,
            },
          }),
          tx.payment.findUnique({
            where: { id: ids.trustedPaymentId },
            select: {
              id: true,
              status: true,
              resultCode: true,
              receiptNumber: true,
              callbackPayload: true,
            },
          }),
          tx.analyticsEvent.findFirst({
            where: {
              orderId: ids.trustedOrderId,
              eventType: "payment_success",
              source: "callback",
            },
            select: {
              id: true,
              metadata: true,
            },
            orderBy: { createdAt: "desc" },
          }),
        ]);

        return { order, payment, analyticsEvent };
      },
    });

    assert(trustedState.order?.status === "confirmed", "Trusted callback did not confirm the order under RLS.");
    assert(trustedState.order?.paymentStatus === "paid", "Trusted callback did not mark the order as paid under RLS.");
    assert(trustedState.payment?.status === "paid", "Trusted callback did not mark the payment as paid under RLS.");
    assert(Boolean(trustedState.payment?.receiptNumber), "Trusted callback did not persist the receipt number.");
    assert(Boolean(trustedState.payment?.callbackPayload), "Trusted callback did not persist callback payload.");
    assert(Boolean(trustedState.analyticsEvent?.id), "Trusted callback did not persist the callback analytics event.");

    const conflictingHintResult = await handleStkCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: ids.conflictCheckoutRequestId,
          ResultCode: 0,
          ResultDesc: "The service request is processed successfully.",
          CallbackMetadata: {
            Item: [
              { Name: "MpesaReceiptNumber", Value: `RLS-CONFLICT-${Date.now()}` },
              { Name: "RestaurantId", Value: conflictingHintRestaurantId },
            ],
          },
        },
      },
    });

    assert(
      conflictingHintResult.ignored === true && conflictingHintResult.rejected === true,
      "Weak conflicting restaurant hint was not rejected."
    );

    const conflictState = await runWithTenantContext({
      restaurantId: probeRestaurantId,
      userId: TENANT_USER_ID,
      isAdmin: false,
      fn: async (tx) => {
        const [order, payment] = await Promise.all([
          tx.order.findUnique({
            where: { id: ids.conflictOrderId },
            select: {
              id: true,
              status: true,
              paymentStatus: true,
              paymentReference: true,
            },
          }),
          tx.payment.findUnique({
            where: { id: ids.conflictPaymentId },
            select: {
              id: true,
              status: true,
              resultCode: true,
              receiptNumber: true,
            },
          }),
        ]);
        return { order, payment };
      },
    });

    assert(conflictState.order?.status === "pending", "Conflicting restaurant hint unexpectedly changed order status.");
    assert(
      conflictState.order?.paymentStatus === "processing",
      "Conflicting restaurant hint unexpectedly changed order payment status."
    );
    assert(conflictState.payment?.status === "processing", "Conflicting restaurant hint unexpectedly changed payment status.");
    assert(!conflictState.payment?.receiptNumber, "Conflicting restaurant hint unexpectedly wrote a receipt number.");

    const missingLinkageBefore = await runWithPaymentCallbackResolutionDbContext(
      { actorIdentifier: ids.missingCheckoutRequestId },
      () =>
        prisma.payment.findUnique({
          where: { checkoutRequestId: ids.missingCheckoutRequestId },
          select: { id: true },
        })
    );
    assert(!missingLinkageBefore, "Missing-linkage callback probe unexpectedly found a pre-existing payment row.");

    const missingLinkageResult = await handleStkCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: ids.missingCheckoutRequestId,
          ResultCode: 0,
          ResultDesc: "The service request is processed successfully.",
        },
      },
    });

    assert(missingLinkageResult.ignored === true, "Missing checkoutRequestId linkage did not fail closed.");

    const missingLinkageAfter = await runWithPaymentCallbackResolutionDbContext(
      { actorIdentifier: ids.missingCheckoutRequestId },
      () =>
        prisma.payment.findUnique({
          where: { checkoutRequestId: ids.missingCheckoutRequestId },
          select: { id: true },
        })
    );
    assert(!missingLinkageAfter, "Missing-linkage callback unexpectedly created or touched a payment row.");

    const auditRows = await runWithPaymentCallbackResolutionDbContext(
      { actorIdentifier: ids.trustedCheckoutRequestId },
      () =>
        prisma.auditLog.findMany({
          where: {
            action: "payment_status_changed",
            targetType: "order",
            targetId: ids.trustedOrderId,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            actorUserId: true,
            systemActorKey: true,
            actorRole: true,
            metadata: true,
          },
        })
    );

    assert(auditRows.length > 0, "Trusted callback did not persist an audit row.");
    assert(
      auditRows.some((row) => row.systemActorKey === "payment_provider_callback" && !row.actorUserId),
      "Trusted callback audit row did not use the explicit payment callback system actor."
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          envName,
          probeRestaurantId,
          trustedCallbackResolution: trustedResult,
          trustedState,
          conflictingHintRestaurantId,
          conflictingHintResult,
          conflictState,
          missingLinkageResult,
          auditRows,
        },
        null,
        2
      )
    );
  } finally {
    await sleep(250);
    try {
      await runWithPaymentCallbackResolutionDbContext({ actorIdentifier: ids.trustedCheckoutRequestId }, () =>
        prisma.auditLog.deleteMany({
          where: {
            targetType: "order",
            targetId: { in: [ids.trustedOrderId, ids.conflictOrderId] },
          },
        })
      );
    } catch {}

    try {
      await runWithTenantContext({
        restaurantId: probeRestaurantId,
        userId: TENANT_USER_ID,
        isAdmin: false,
        fn: async (tx) => {
          await tx.analyticsEvent.deleteMany({
            where: { orderId: { in: [ids.trustedOrderId, ids.conflictOrderId] } },
          });
          await tx.payment.deleteMany({
            where: { id: { in: [ids.trustedPaymentId, ids.conflictPaymentId] } },
          });
          await tx.order.deleteMany({
            where: { id: { in: [ids.trustedOrderId, ids.conflictOrderId] } },
          });
        },
      });
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch((error) => {
  console.error(`[rls-payment-callback-validate] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});