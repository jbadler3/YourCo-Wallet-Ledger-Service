import { Router } from "express";
import { getItemByItemId, ITEMS } from "../constants/items";

export const itemsRouter = Router();
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

itemsRouter.get("/", async (_request, response) => {
  // to do: implement pagination
  response.status(200).json(ITEMS);
});

itemsRouter.get("/:itemId", async (request, response) => {
  const itemId = request.params.itemId;
  if (!UUID_REGEX.test(itemId)) {
    response.status(400).json({
      message: "itemId must be a valid UUID.",
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
