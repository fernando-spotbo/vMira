-- Add display_name for "What should Mira call you?" (short greeting name)
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
