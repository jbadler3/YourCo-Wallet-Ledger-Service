import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { resetDatabase, TEST_USER_1 } from "./helpers/db";

describe("items endpoints", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("lists seeded items for an authenticated request", async () => {
    const response = await request(createApp())
      .get("/api/items")
      .set("x-user-id", TEST_USER_1);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { itemId: "11111111-1111-1111-1111-111111111111", name: "Car", price: 500 },
      { itemId: "22222222-2222-2222-2222-222222222222", name: "Bike", price: 250 },
      { itemId: "33333333-3333-3333-3333-333333333333", name: "TV", price: 100 },
    ]);
  });
});
