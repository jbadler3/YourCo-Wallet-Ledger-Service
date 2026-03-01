export type Item = {
  itemId: string;
  name: string;
  price: number;
};

export const ITEMS: Item[] = [
  { itemId: "11111111-1111-1111-1111-111111111111", name: "Car", price: 500 },
  { itemId: "22222222-2222-2222-2222-222222222222", name: "Bike", price: 250 },
  { itemId: "33333333-3333-3333-3333-333333333333", name: "TV", price: 100 }
  // to do: add more items so that we could test pagination
];

const ITEMS_BY_ID = new Map<string, Item>(
  ITEMS.map((item) => [item.itemId, item]),
);

export const getItemByItemId = (itemId: string) => ITEMS_BY_ID.get(itemId);
