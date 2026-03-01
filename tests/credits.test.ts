import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { resetDatabase, TEST_USER_1 } from "./helpers/db";

describe("credits endpoint", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("rejects invalid credit amount", async () => {
    const response = await request(createApp())
      .post("/api/credits")
      .set("x-user-id", TEST_USER_1)
      .set("idempotency-key", "credit-invalid")
      .send({ amount: 0 });

    expect(response.status).toBe(400);
  });

  it("adds credit and returns updated balance", async () => {
    const response = await request(createApp())
      .post("/api/credits")
      .set("x-user-id", TEST_USER_1)
      .set("idempotency-key", "credit-1")
      .send({ amount: 100 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ balance: 600 });
  });

  it("reuses same idempotency-key without double-crediting", async () => {
    const app = createApp();

    const first = await request(app)
      .post("/api/credits")
      .set("x-user-id", TEST_USER_1)
      .set("idempotency-key", "same-credit-key")
      .send({ amount: 100 });

    const second = await request(app)
      .post("/api/credits")
      .set("x-user-id", TEST_USER_1)
      .set("idempotency-key", "same-credit-key")
      .send({ amount: 100 });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body).toEqual({ balance: 600 });
    expect(second.body).toEqual({ balance: 600 });

    const transactionCount = await prisma.transaction.count({
      where: {
        userId: TEST_USER_1,
        amount: -100,
      },
    });

    expect(transactionCount).toBe(1);
  });
});
