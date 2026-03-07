import { Router } from "express";
import { Prisma } from "@prisma/client";
import { getItemByItemId } from "../constants/items";
import { prisma } from "../lib/prisma";
import { cacheGlobal } from "../lib/cache";

type PurchaseRequestBody = {
  itemId?: unknown;
};

class ItemNotFoundError extends Error {}
class InsufficientBalanceError extends Error {}

export const purchasesRouter = Router();
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

purchasesRouter.post("/", async (request, response) => {
  const { itemId } = request.body as PurchaseRequestBody;

  if (typeof itemId !== "string" || !UUID_REGEX.test(itemId)) {
    response.status(400).json({
      message: "itemId must be a valid UUID item identifier.",
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

  try {
    await prisma.$transaction(async (tx) => {
      // Serialize purchase processing per user to prevent overspending races.
      await tx.$executeRaw`SET LOCAL lock_timeout = '4500ms'`; // deliberately shorter than prisma 5s default
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

      const existingIdempotencyRecord = await tx.idempotencyKey.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey,
          },
        },
      });

      if (existingIdempotencyRecord) {
        return;
      }

      const item = getItemByItemId(itemId);
      if (!item) {
        throw new ItemNotFoundError();
      }

      const balance = await getUserBalance(tx, userId);
      if (balance < item.price) {
        throw new InsufficientBalanceError();
      }

      const createdTransaction = await tx.transaction.create({
        data: {
          userId,
          amount: item.price,
        },
      });

      await tx.productTransaction.create({
        data: {
          transactionId: createdTransaction.id,
          itemId: item.itemId,
          priceAtPurchase: item.price,
        },
      });

      await tx.idempotencyKey.create({
        data: {
          userId,
          idempotencyKey,
          transactionId: createdTransaction.id,
        },
      });
    });

    response.status(204).send();
    return;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" // unique constraint violation
    ) {
      // Another request with the same idempotency key likely won the race and already wrote the records.
      // Treat this as success to preserve idempotency behavior.
      response.status(204).send();
      return;
    }

    if (error instanceof ItemNotFoundError) {
      response.status(404).json({
        message: "Item not found.",
      });
      return;
    }

    if (error instanceof InsufficientBalanceError) {
      response.status(409).json({
        message: "Insufficient balance.",
      });
      return;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2010" || error.code === "P2028")
    ) {
      // P2010: Postgres Lock Timeout
      // P2028: Prisma Transaction Timeout
      response.status(409).json({
        message: "Another purchase is currently processing. Please try again in a moment.",
      });
      return;
    }

    console.error("Unexpected purchases error:", error);
    throw error;
  }
});
