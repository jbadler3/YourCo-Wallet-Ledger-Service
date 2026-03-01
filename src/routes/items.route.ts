import { Router } from "express";
import { getItemByItemId, ITEMS } from "../constants/items";

export const itemsRouter = Router();

itemsRouter.get("/", async (_request, response) => {
  response.status(200).json(ITEMS);
});

itemsRouter.get("/:itemId", async (request, response) => {
  const itemId = Number.parseInt(request.params.itemId, 10);

  if (Number.isNaN(itemId)) {
    response.status(400).json({
      message: "itemId must be a valid integer.",
    });
    return;
  }

  const item = getItemByItemId(itemId);

  if (!item) {
    response.status(404).json({
      message: "Item not found.",
    });
    return;
  }

  response.status(200).json(item);
});
