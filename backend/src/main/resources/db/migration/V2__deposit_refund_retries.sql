ALTER TABLE deposit_refunds
    ADD COLUMN retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    ADD COLUMN next_attempt_at timestamp;

CREATE INDEX idx_deposit_refunds_retryable
    ON deposit_refunds (next_attempt_at)
    WHERE completed_at IS NULL;
