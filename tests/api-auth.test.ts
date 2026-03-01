import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { resetDatabase } from "./helpers/db";

type ApiCase = {
  name: string;
  method: "get" | "post";
  path: string;
  body?: Record<string, unknown>;
};

const apiCases: ApiCase[] = [
  { name: "GET /api/items", method: "get", path: "/api/items" },
  { name: "GET /api/items/:itemId", method: "get", path: "/api/items/1" },
  { name: "GET /api/balance", method: "get", path: "/api/balance" },
  { name: "POST /api/credits", method: "post", path: "/api/credits"  },
  { name: "POST /api/purchases", method: "post", path: "/api/purchases" },
];

describe("api auth guard", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("keeps /health public without x-user-id", async () => {
    const response = await request(createApp()).get("/health");
    expect(response.status).toBe(200);
  });

  it.each(apiCases)("rejects $name when x-user-id is missing", async (apiCase) => {
    let req = request(createApp())[apiCase.method](apiCase.path);

    if (apiCase.body) {
      req = req.send(apiCase.body);
    }

    const response = await req;
    expect(response.status).toBe(400);
  });
});
