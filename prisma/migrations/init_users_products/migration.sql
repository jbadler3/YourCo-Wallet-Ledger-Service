CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE IF NOT EXISTS "transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "product_transactions" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "price_at_purchase" INTEGER NOT NULL,

    CONSTRAINT "product_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "idempotency_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "transaction_id" UUID NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "transactions_user_id_idx" ON "transactions"("user_id");

CREATE INDEX IF NOT EXISTS "product_transactions_transaction_id_idx" ON "product_transactions"("transaction_id");

CREATE INDEX IF NOT EXISTS "product_transactions_item_id_idx" ON "product_transactions"("item_id");

-- user can not can not somehow send same idempotency key twice. (maybe browser sends it twice somehow or retries before the first one is processed)
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_keys_user_id_idempotency_key_key" ON "idempotency_keys"("user_id", "idempotency_key");

-- each transaction can only be processed once
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_keys_transaction_id_key" ON "idempotency_keys"("transaction_id");

-- Seed starting balances as credit transactions (500 each)
INSERT INTO "transactions" ("id", "user_id", "amount") VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', -500),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', -500),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', -500)
ON CONFLICT ("id") DO NOTHING;
