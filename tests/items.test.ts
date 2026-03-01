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
      { itemId: 1, name: "Car", price: 500 },
      { itemId: 2, name: "Bike", price: 250 },
      { itemId: 3, name: "TV", price: 100 },
    ]);
  });
});
