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

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",").map((item) => item.trim()) || true,
    credentials: true,
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "menuvista-backend" });
});

app.use("/auth", authRouter);
app.use("/restaurants", restaurantRouter);
app.use("/categories", categoriesRouter);
app.use("/dishes", dishesRouter);
app.use("/orders", ordersRouter);
app.use("/payments", paymentsRouter);
app.use("/uploads", uploadsRouter);
app.use("/analytics", analyticsRouter);
app.use("/admin", adminRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`MenuVista backend running on http://localhost:${port}`);
});
