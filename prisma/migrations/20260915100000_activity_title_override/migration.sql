BEGIN;

-- Add the weekly title to databases initialized before it joined the canonical schema.
ALTER TABLE "ActivityStatus" ADD COLUMN IF NOT EXISTS "titleOverride" TEXT;

COMMIT;
