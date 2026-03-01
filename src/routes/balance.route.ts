import { Router } from "express";
import { prisma } from "../lib/prisma";

export const balanceRouter = Router();

balanceRouter.get("/", async (request, response) => {
  const userId = request.header("x-user-id") ?? "";

  const aggregateResult = await prisma.transaction.aggregate({
    _sum: {
      amount: true,
    },
    where: {
      userId,
    },
  });

  const balance = -(aggregateResult._sum.amount ?? 0);

  response.status(200).json({
    balance,
  });
});
