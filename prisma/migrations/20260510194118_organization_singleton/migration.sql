-- UFB-047 / Phase 48-A: Organization identity singleton.
--
-- shortName: compact brand string (nav-bar, page chrome, ≤16 chars by app rule)
-- fullName:  long-form description (landing hero, PDF report header)
--
-- Singleton invariant is enforced at the application layer (`id='singleton'`
-- upserts in the service); we do NOT add a DB CHECK so future plans can
-- evolve to multi-tenant without a migration cliff.

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "shortName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row with the concrete identity the org owner specified
-- (Demo / Example Software Department). Idempotent against reruns:
-- ON CONFLICT means a follow-up `prisma migrate reset` keeps the same row,
-- and re-running this migration on a DB that already has the row is a no-op.
INSERT INTO "Organization" (id, "shortName", "fullName", "createdAt", "updatedAt")
VALUES ('singleton', 'Demo', 'Example Software Department', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- NOTE: AppSettings.departmentName is intentionally LEFT IN PLACE for this
-- release. The lead-form and weekly-report flows still read departmentName
-- as the section's department label. A follow-up plan (Phase 48-B or later)
-- will: (1) rewire those consumers to Organization.fullName, (2) drop the
-- departmentName column. Until then both fields coexist; the Identity tab
-- writes only to Organization.
