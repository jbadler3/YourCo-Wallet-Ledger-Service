## how to run locally

1. Install dependencies:
   - `npm install`
2. Create your local environment file:
   - copy `.env.example` to `.env`
3. Update `DATABASE_URL` in `.env` to match your local Postgres instance.
   - takes password, and database in the URL
4. Generate Prisma client:
   - `npm run prisma:generate`

## Run Locally

1. Start PostgreSQL locally and make sure `DATABASE_URL` points to it.
2. Apply migrations:
   - `npm run prisma:migrate:deploy`
3. Start the API:
   - `npm run dev`
4. (optional) Run the tests:
   -  `npm run test `

Note: 
5. If you are going to test endpoints with Postman, there is a Pre Request script at the bottom which will make your life easier for the User Id and idempotency key

## Migrations

Current schema includes:

- `transactions`
- `product_transactions`
- `idempotency_keys`

This initial migration also seeds:

- Starting credit transactions of `500` for these user IDs (stored as `amount=-500`):
  - `00000000-0000-0000-0000-000000000001`
  - `00000000-0000-0000-0000-000000000002`
  - `00000000-0000-0000-0000-000000000003`

## API Notes

- Public endpoint (no user header required):
  - `GET /health`
- All `/api/` endpoints require header:
  - `x-user-id: <UUID>`
- Items endpoints:
  - `GET /api/items`
  - `GET /api/items/:itemId`

Items are hardcoded in `src/constants/items.ts`


## Indexes
- `transactions_user_id_idx` – non-unique on `transactions(user_id)`. Speeds up balance aggregation (most frequent operation in this app) and transaction lookups by user.
- `product_transactions_transaction_id_idx` – non-unique on `product_transactions(transaction_id)`. Speeds up joining product rows to a transaction and getting a full transaction
- `product_transactions_item_id_idx` – non-unique on `product_transactions(item_id)`. Speeds up queries like “all purchases of item X.”

Tradeoffs: Indexes speed up reads but add write cost (each insert/update must update the index).  For this app, reads (balance, idempotency checks) are common and writes are less frequent, so the tradeoff is favorable.

## Concurrency Approach
Purchases run inside a Prisma transaction and acquire a Postgres transaction-scoped advisory lock keyed by `userId` (`pg_advisory_xact_lock(hashtext(userId))`). This serializes purchase processing per user so concurrent requests cannot both pass the balance check and overspend below zero.

## Idempotency Note
Credits and purchases require an `idempotency-key` header. The API stores `(user_id, idempotency_key)` in idempotency_keys with a unique index, so retries of the same logical request do not create duplicate ledger rows. If a duplicate key is seen (including a race that triggers `P2002`), the request is treated as already processed and returns success.

## Test Coverage

`METHOD / ENDPOINT / context / expectation`

`GET /health`
- `GET /health / no x-user-id / 200`

`Auth Guard (/api/)`
- `GET /api/items / missing x-user-id / 400`
- `GET /api/items/1 / missing x-user-id / 400`
- `GET /api/balance / missing x-user-id / 400`
- `POST /api/credits / missing x-user-id / 400`
- `POST /api/purchases / missing x-user-id / 400`

`GET /api/items`
- `GET /api/items / valid x-user-id / 200 + hardcoded items`

`GET /api/balance`
- `GET /api/balance / user has no transactions / { "balance": 0 }`
- `GET /api/balance / user has transactions / 200 + current balance`

`POST /api/credits`
- `POST /api/credits / amount <= 0 / 400`
- `POST /api/credits / valid amount and key / 200 + updated balance`
- `POST /api/credits / same idempotency-key retried / no duplicate credit`

`POST /api/purchases`
- `POST /api/purchases / itemId does not exist / 404`
- `POST /api/purchases / insufficient balance / 409`
- `POST /api/purchases / valid item and balance / 204`
- `POST /api/purchases x2 concurrent / same user / one 204, one 409`
- `POST /api/purchases x2 concurrent but big enough balance / same user / two 204`
- `POST /api/purchases / item price changes later / stored priceAtPurchase unchanged`

## Postman Pre Request Script

`const userId = "00000000-0000-0000-0000-000000000001";`
`const idempotencyKey = crypto.randomUUID();`

`pm.request.headers.upsert({  key: "x-user-id",  value: userId,});`

`pm.request.headers.upsert({key: "idempotency-key", value: idempotencyKey,});`