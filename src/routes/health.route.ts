import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: "wallet-ledger-service",
    timestamp: new Date().toISOString(),
  });
});
