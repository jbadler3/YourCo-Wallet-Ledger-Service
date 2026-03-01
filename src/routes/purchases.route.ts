import { Router } from "express";
import { Prisma } from "@prisma/client";
import { getItemByItemId } from "../constants/items";
import { prisma } from "../lib/prisma";

type PurchaseRequestBody = {
  itemId?: unknown;
};

class ItemNotFoundError extends Error {}
class InsufficientBalanceError extends Error {}

export const purchasesRouter = Router();
const MAX_RETRIES = 3;

const getUserBalance = async (tx: Prisma.TransactionClient, userId: string) => {
  const aggregateResult = await tx.transaction.aggregate({
    _sum: {
      amount: true,
    },
    where: {
      userId,
    },
  });

  return -1 * (aggregateResult._sum.amount ?? 0);
};

const isRetryableConcurrencyError = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2034";
  }

  if (error && typeof error === "object") {
    const maybeCause = (error as { cause?: unknown }).cause;

    if (maybeCause && typeof maybeCause === "object") {
      const originalCode = (maybeCause as { originalCode?: string }).originalCode;
      const kind = (maybeCause as { kind?: string }).kind;

      if (originalCode === "40001" || kind === "TransactionWriteConflict") {
        return true;
      }
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("serialize") ||
      message.includes("serialization") ||
      message.includes("could not serialize") ||
      message.includes("deadlock detected") ||
      message.includes("transactionwriteconflict")
    );
  }

  return false;
};

purchasesRouter.post("/", async (request, response) => {
  const { itemId } = request.body as PurchaseRequestBody;

  // itemId maps to the numeric itemId identifier in src/constants/items.ts.
  const parsedItemId =
    typeof itemId === "number"
      ? itemId
      : Number.parseInt(String(itemId ?? ""), 10);

  if (!Number.isInteger(parsedItemId) || parsedItemId <= 0) {
    response.status(400).json({
      message: "itemId must be a positive integer item identifier.",
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

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const existingIdempotencyRecord = await tx.idempotencyKey.findUnique({
            where: {
              userId_idempotencyKey: {
                userId,
                idempotencyKey,
              },
            },
          });

          if (existingIdempotencyRecord) {
            // this means the request was a duplicate, so we can just return
            return;
          }

          const item = getItemByItemId(parsedItemId);
          // if the item is not found, we throw an error
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
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      response.status(204).send();
      return;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" // unique constraint violation
      ) {
        // Another request with the same idempotency key likely won the race and already wrote the records.
        // We treat this as success to preserve idempotent behavior.
        response.status(204).send();
        return;
      }

      if (isRetryableConcurrencyError(error) && attempt < MAX_RETRIES) {
        // Retry serialization/deadlock conflicts caused by concurrent transactions.
        continue;
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

      console.error("Unexpected purchases error:", error);
      throw error;
    }
  }

  response.status(409).json({
    message: "Could not safely process purchase. Please retry.",
  });
});
