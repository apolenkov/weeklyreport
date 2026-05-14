-- A2 (UAT-v7 2026-05-12): add isActive soft-deactivation flag to User.
--
-- All existing rows default to true (active). The flag is checked by the
-- tRPC context factory on every authenticated request in addition to the
-- Redis revoked-set fast path (customreport:revoked).
--
-- Strategy: safe non-destructive ALTER; default=true preserves all existing
-- sessions. No data loss.

ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
