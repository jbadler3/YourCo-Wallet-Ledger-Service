## Run locally

1. Install dependencies:
   - `npm install`
2. Create your local environment file:
   - Copy `.env.example` to `.env`
3. Update `DATABASE_URL` in `.env` to match your local Postgres instance.
   - Include your DB user, password, host, port, and database name in the URL.
4. Start PostgreSQL locally and make sure `DATABASE_URL` points to the db you created.
5. Generate Prisma client:
   - `npm run prisma:generate`
6. Apply migrations:
   - `npm run prisma:migrate:deploy`
7. Start the API:
   - `npm run dev`
8. Optional: run tests
   - `npm run test`

If you are testing endpoints in Postman, use the pre-request script at the bottom to auto-set `x-user-id` and `idempotency-key`.

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
- `product_transactions_transaction_id_idx` – non-unique on `product_transactions(transaction_id)`. Speeds up looking up items per transaction. Not needed right now, but would be needed for the future. 
- `product_transactions_item_id_idx` – non-unique on `product_transactions(item_id)`. Speeds up queries like “all purchases of item X.”

Tradeoffs: Indexes speed up reads but add write cost (each insert/update must update the index).  For this app, reads (balance, idempotency checks) are common and writes are less frequent, so the tradeoff is favorable.

## Concurrency Approach
Purchases run inside a Prisma transaction and acquire a Postgres transaction-scoped advisory lock keyed by `userId` (`pg_advisory_xact_lock(hashtext(userId))`). This serializes purchase processing per user so concurrent requests cannot both pass the balance check and overspend below zero.

## Idempotency Note
Credits and purchases require an `idempotency-key` header. The API stores `(user_id, idempotency_key)` in idempotency_keys with a unique index, so retries of the same logical request do not create duplicate ledger rows. If a duplicate key is seen (including a race that triggers `P2002`), the request is treated as already processed and returns success. There is also a unique index on `transaction_id` in `idempotency_keys` so that if something goes wrong, a transaction is not processed twice even if the idempotency key was changed. There is no unique index on `idempotency_keys` because two users should be able to use the same key for different transactions and not have failure. 

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
