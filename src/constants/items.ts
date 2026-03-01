export type Item = {
  itemId: number;
  name: string;
  price: number;
};

export const ITEMS: Item[] = [
  { itemId: 1, name: "Car", price: 500 },
  { itemId: 2, name: "Bike", price: 250 },
  { itemId: 3, name: "TV", price: 100 }
  // to do: add more items so that we could test pagination
];

const ITEMS_BY_ID = new Map<number, Item>(
  ITEMS.map((item) => [item.itemId, item]),
);

export const getItemByItemId = (itemId: number) => ITEMS_BY_ID.get(itemId);
