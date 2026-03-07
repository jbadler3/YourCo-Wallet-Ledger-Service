import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { cacheGlobal } from "../lib/cache";

type CreditRequestBody = {
  amount?: unknown;
};

export const creditsRouter = Router();

const getUserBalance = async (tx: Prisma.TransactionClient, userId: string) => {
  const aggregateResult = await tx.transaction.aggregate({
    _sum: {
      amount: true,
    },
    where: {
      userId,
    },
  });

  let amountValue = -1 * Number(aggregateResult._sum.amount ?? 0);
  cacheGlobal.setUserBalance(userId, amountValue);
  return amountValue;
};

creditsRouter.post("/", async (request, response) => {
  const { amount } = request.body as CreditRequestBody;

  if (!Number.isInteger(amount) || Number(amount) <= 0) {
    response.status(400).json({
      message: "amount must be a positive integer greater than 0.",
    });
    return;
  }

  const userId = request.header("x-user-id") ?? "";
  const idempotencyKey = request.header("idempotency-key");

  if (!idempotencyKey) {
    response.status(400).json({
      message: "idempotency-key header is required.",
    });
    return;
  }

  const creditAmount = Number(amount);
  let balance = 0;

  try {
    balance = await prisma.$transaction(async (tx) => {
      const existingIdempotencyRecord = await tx.idempotencyKey.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey,
          },
        },
      });

      if (!existingIdempotencyRecord) {
        const createdTransaction = await tx.transaction.create({
          data: {
            userId,
            amount: -1 * creditAmount,
          },
        });

        await tx.idempotencyKey.create({
          data: {
            userId,
            idempotencyKey,
            transactionId: createdTransaction.id,
          },
        });
      }

      return getUserBalance(tx, userId);
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" // unique constraint violation
    ) {
      // means there were two requests with the same idempotency key, so it might not have been an error in the first place
      // so we can just get the balance again
      balance = await prisma.$transaction(async (tx) => getUserBalance(tx, userId));
    } else {
      throw error;
    }
  }

  response.status(200).json({
    balance,
  });
});
