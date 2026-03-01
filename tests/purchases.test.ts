import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { ITEMS } from "../src/constants/items";
import { prisma } from "../src/lib/prisma";
import { resetDatabase, TEST_USER_1 } from "./helpers/db";

describe("purchases endpoint", () => {
  const CAR_ITEM_ID = "11111111-1111-1111-1111-111111111111";
  const BIKE_ITEM_ID = "22222222-2222-2222-2222-222222222222";
  const TV_ITEM_ID = "33333333-3333-3333-3333-333333333333";

  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns 404 when the item does not exist", async () => {
    const response = await request(createApp())
      .post("/api/purchases")
      .set("x-user-id", TEST_USER_1)
      .set("idempotency-key", "purchase-missing-item")
      .send({ itemId: "44444444-4444-4444-4444-444444444444" });

    expect(response.status).toBe(404);
  });

  it("returns 409 when user has insufficient balance", async () => {
    const app = createApp();

    await request(app)
      .post("/api/purchases")
      .set("x-user-id", TEST_USER_1)
      .set("idempotency-key", "purchase-1")
      .send({ itemId: CAR_ITEM_ID });

    const secondAttempt = await request(app)
      .post("/api/purchases")
      .set("x-user-id", TEST_USER_1)
      .set("idempotency-key", "purchase-2")
      .send({ itemId: CAR_ITEM_ID });

    expect(secondAttempt.status).toBe(409);
  });

  it("returns 204 on success and updates balance", async () => {
    const app = createApp();

    const purchaseResponse = await request(app)
      .post("/api/purchases")
      .set("x-user-id", TEST_USER_1)
      .set("idempotency-key", "purchase-success")
      .send({ itemId: BIKE_ITEM_ID });

    expect(purchaseResponse.status).toBe(204);

    const balanceResponse = await request(app)
      .get("/api/balance")
      .set("x-user-id", TEST_USER_1);

    expect(balanceResponse.status).toBe(200);
    expect(balanceResponse.body).toEqual({ balance: 250 });
  });

  it("is concurrency-safe for simultaneous purchases", async () => {
    const app = createApp();

    const [first, second] = await Promise.all([
      request(app)
        .post("/api/purchases")
        .set("x-user-id", TEST_USER_1)
        .set("idempotency-key", "concurrency-a")
        .send({ itemId: CAR_ITEM_ID }),
      request(app)
        .post("/api/purchases")
        .set("x-user-id", TEST_USER_1)
        .set("idempotency-key", "concurrency-b")
        .send({ itemId: CAR_ITEM_ID }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([204, 409]);

    const balanceResponse = await request(app)
      .get("/api/balance")
      .set("x-user-id", TEST_USER_1);

    expect(balanceResponse.status).toBe(200);
    expect(balanceResponse.body).toEqual({ balance: 0 });
  });

  it("allows two concurrent purchases when balance can cover both", async () => {
    const app = createApp();

    const [first, second] = await Promise.all([
      request(app)
        .post("/api/purchases")
        .set("x-user-id", TEST_USER_1)
        .set("idempotency-key", "concurrency-nonconflict-a")
        .send({ itemId: TV_ITEM_ID }),
      request(app)
        .post("/api/purchases")
        .set("x-user-id", TEST_USER_1)
        .set("idempotency-key", "concurrency-nonconflict-b")
        .send({ itemId: TV_ITEM_ID }),
    ]);

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);

    const balanceResponse = await request(app)
      .get("/api/balance")
      .set("x-user-id", TEST_USER_1);

    expect(balanceResponse.status).toBe(200);
    expect(balanceResponse.body).toEqual({ balance: 300 });

    const purchaseTransactionCount = await prisma.transaction.count({
      where: {
        userId: TEST_USER_1,
        amount: 100,
      },
    });

    const productTransactionCount = await prisma.productTransaction.count({
      where: {
        itemId: TV_ITEM_ID,
      },
    });

    expect(purchaseTransactionCount).toBe(2);
    expect(productTransactionCount).toBe(2);
  });

  it("persists priceAtPurchase even if item price changes later", async () => {
    const app = createApp();
    const item = ITEMS.find((entry) => entry.itemId === BIKE_ITEM_ID);

    if (!item) {
      throw new Error("Expected bike itemId to exist in constants.");
    }

    const originalPrice = item.price;

    try {
      const purchaseResponse = await request(app)
        .post("/api/purchases")
        .set("x-user-id", TEST_USER_1)
        .set("idempotency-key", "purchase-price-persist")
        .send({ itemId: BIKE_ITEM_ID });

      expect(purchaseResponse.status).toBe(204);

      item.price = originalPrice + 500;

      const idempotencyRecord = await prisma.idempotencyKey.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: TEST_USER_1,
            idempotencyKey: "purchase-price-persist",
          },
        },
      });

      expect(idempotencyRecord).not.toBeNull();

      const productTransaction = await prisma.productTransaction.findFirst({
        where: {
          transactionId: idempotencyRecord!.transactionId,
        },
      });

      expect(productTransaction).not.toBeNull();
      expect(productTransaction!.priceAtPurchase).toBe(originalPrice);
    } finally {
      item.price = originalPrice;
    }
  });
});
