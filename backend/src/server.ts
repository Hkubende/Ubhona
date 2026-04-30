import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { restaurantRouter } from "./routes/restaurants.js";
import { categoriesRouter } from "./routes/categories.js";
import { dishesRouter } from "./routes/dishes.js";
import { ordersRouter } from "./routes/orders.js";
import { paymentsRouter } from "./routes/payments.js";
import { uploadsRouter } from "./routes/uploads.js";
import { analyticsRouter } from "./routes/analytics.js";
import { adminRouter } from "./routes/admin.js";
import { billingRouter } from "./routes/billing.js";
import { inventoryRouter } from "./routes/inventory.js";
import { floorRouter } from "./routes/floor.js";
import { createRateLimiter } from "./middleware/rate-limit.js";
import { prisma } from "./prisma.js";

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",").map((item) => item.trim()) || true,
    credentials: true,
  })
);
app.use(express.json());
app.use(
  createRateLimiter({
    keyPrefix: "global",
    windowMs: 60 * 1000,
    max: 240,
    message: "Rate limit exceeded. Please slow down.",
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "ubhona-backend" });
});

app.get("/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: "ubhona-backend", checks: { dbReachable: true } });
  } catch (error) {
    res.status(500).json({
      ok: false,
      service: "ubhona-backend",
      checks: {
        dbReachable: false,
        message: error instanceof Error ? error.message : "Database health probe failed.",
      },
    });
  }
});

app.use("/auth", authRouter);
app.use("/restaurants", restaurantRouter);
app.use("/categories", categoriesRouter);
app.use("/dishes", dishesRouter);
app.use("/orders", ordersRouter);
app.use("/payments", paymentsRouter);
app.use("/uploads", uploadsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/analytics", analyticsRouter);
app.use("/admin", adminRouter);
app.use("/billing", billingRouter);
app.use("/inventory", inventoryRouter);
app.use("/floor", floorRouter);

app.use((err: unknown, _req: express.Request, res: express.Response) => {
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "LIMIT_FILE_SIZE"
  ) {
    res.status(400).json({ error: "File too large for this upload endpoint." });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`MenuVista backend running on http://localhost:${port}`);
});
