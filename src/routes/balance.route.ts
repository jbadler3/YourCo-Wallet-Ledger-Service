import { Router } from "express";
import { prisma } from "../lib/prisma";
import { cacheGlobal } from "../lib/cache";

export const balanceRouter = Router();

balanceRouter.get("/", async (request, response) => {
  const userId = request.header("x-user-id") ?? "";

  // get cached value here
  let userCache = cacheGlobal.getUserBalance(userId);
  let balance = 0;
  
  if (userCache == -1) {
    // if no cached value: 
    const aggregateResult = await prisma.transaction.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        userId,
      },
    });
  
    balance = -(aggregateResult._sum.amount ?? 0);
    
    cacheGlobal.setUserBalance(userId, balance);
  } else {
    balance = userCache;
  }

  // set the cache value

  response.status(200).json({
    balance,
  });
});
