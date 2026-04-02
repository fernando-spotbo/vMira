-- Overage billing opt-in: allows users to continue past daily limits
-- by paying per-token from their balance. Disabled by default.
ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_overage_billing BOOLEAN NOT NULL DEFAULT FALSE;
