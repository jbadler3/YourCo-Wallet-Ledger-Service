Some dilemmas I faced while creating the project

Almost had a credit table vs purchases table. Thought the data fields were essentially the same, and summing would be quicker and have better run time if I combined them. Almost included an is_credit column, but I could've just used negatives and positives. This is better for performance because balance is just one SUM(amount) query, instead of conditionals/two separate totals.

Added idempotency for both credits and purchases. Main reason was handling retries/double submits safely so the same request key does not create duplicate ledger rows.

For purchase concurrency, I used a Postgres advisory lock per user in the transaction. This was the safest way to avoid two concurrent purchases both passing the balance check and overspending.