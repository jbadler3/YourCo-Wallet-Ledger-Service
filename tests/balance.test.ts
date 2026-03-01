import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { resetDatabase, TEST_USER_1, TEST_USER_2 } from "./helpers/db";

describe("balance endpoint", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns 0 balance for a user with no records", async () => {
    const response = await request(createApp())
      .get("/api/balance")
      .set("x-user-id", TEST_USER_2);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ balance: 0 });
  });

  it("returns balance for a user with transactions", async () => {
    const response = await request(createApp())
      .get("/api/balance")
      .set("x-user-id", TEST_USER_1);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ balance: 500 });
  });
});
