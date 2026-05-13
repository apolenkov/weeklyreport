-- Viewer visibility is granted through ViewerGroupAccess, not through an
-- owning ReportingGroup. Non-viewer roles still receive a group in app code.
ALTER TABLE "User" ALTER COLUMN "reportingGroupId" DROP NOT NULL;

-- Defer the director role until the product explicitly needs it.
-- Existing director rows become read-only viewers before the enum is narrowed.
UPDATE "UserActionLog" SET "role" = 'viewer' WHERE "role" = 'director';
UPDATE "User"
SET "role" = 'viewer', "reportingGroupId" = NULL
WHERE "role" = 'director';
UPDATE "User" SET "reportingGroupId" = NULL WHERE "role" = 'viewer';

-- PostgreSQL cannot drop an enum value in place. Recreate the enum and cast
-- every dependent column after data normalization above.
CREATE TYPE "Role_new" AS ENUM ('lead', 'head', 'viewer', 'admin');
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role_new"
  USING ("role"::text::"Role_new");
ALTER TABLE "UserActionLog"
  ALTER COLUMN "role" TYPE "Role_new"
  USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
