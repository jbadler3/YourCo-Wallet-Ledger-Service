import express from "express";
import { requireUserIdHeader } from "./middleware/require-user-id-header";
import { balanceRouter } from "./routes/balance.route";
import { creditsRouter } from "./routes/credits.route";
import { healthRouter } from "./routes/health.route";
import { itemsRouter } from "./routes/items.route";
import { purchasesRouter } from "./routes/purchases.route";

export const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use("/health", healthRouter);
  app.use("/api", requireUserIdHeader);
  app.use("/api/balance", balanceRouter);
  app.use("/api/credits", creditsRouter);
  app.use("/api/items", itemsRouter);
  app.use("/api/purchases", purchasesRouter);

  return app;
};
