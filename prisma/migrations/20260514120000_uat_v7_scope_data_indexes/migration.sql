-- UAT v7 repair pass:
--   - enforce the strict one-group-per-product read/write model in indexes;
--   - add FK indexes used by the UAT routes;
--   - repair live seed drift where product leads no longer matched
--     GroupProduct ownership;
--   - keep historical archived sections immutable.

-- Redundant with the B1 unique constraint on productId.
DROP INDEX IF EXISTS "GroupProduct_productId_idx";

-- Redundant with the unique constraint on (reportSectionId, version).
DROP INDEX IF EXISTS "VersionSnapshot_reportSectionId_version_idx";

CREATE INDEX IF NOT EXISTS "ProjectStatus_projectId_idx"
  ON "ProjectStatus" ("projectId");

CREATE INDEX IF NOT EXISTS "PdfExportJob_requestedBy_idx"
  ON "PdfExportJob" ("requestedBy");

CREATE INDEX IF NOT EXISTS "StageAssignment_userId_idx"
  ON "StageAssignment" ("userId");

CREATE INDEX IF NOT EXISTS "ReopenRequest_requestedById_idx"
  ON "ReopenRequest" ("requestedById");

CREATE INDEX IF NOT EXISTS "ReopenRequest_reviewedById_idx"
  ON "ReopenRequest" ("reviewedById");

-- Before this fix, next-week Planned and In Progress both saved as
-- workflowStatus='in_progress' + completed=false. The UI now uses
-- completed=NULL as the explicit Planned marker.
UPDATE "Item"
SET "completed" = NULL
WHERE "type" = 'next'
  AND "workflowStatus" = 'in_progress'
  AND "completed" = false;

-- Product group ownership is the source of truth. If the current product lead
-- is not a lead in the product's owning group, move the product to the first
-- available lead in that owning group. If a group has no lead, leave the row
-- unchanged so the invariant check reports a real provisioning blocker.
WITH repair AS (
  SELECT p.id AS "projectId",
         candidate.id AS "leadId"
  FROM "Project" p
  JOIN "GroupProduct" gp ON gp."productId" = p.id
  JOIN "User" current_lead ON current_lead.id = p."leadId"
  CROSS JOIN LATERAL (
    SELECT u.id
    FROM "User" u
    WHERE u.role = 'lead'
      AND u."reportingGroupId" = gp."groupId"
      AND u."isActive" = true
    ORDER BY u.name ASC, u.id ASC
    LIMIT 1
  ) candidate
  WHERE current_lead.role <> 'lead'
     OR current_lead."reportingGroupId" IS DISTINCT FROM gp."groupId"
)
UPDATE "Project" p
SET "leadId" = repair."leadId"
FROM repair
WHERE p.id = repair."projectId";

-- Non-lead sections are invalid authoring data. Only touch non-archived
-- reports; archived historical data remains immutable unless a deliberate
-- archive migration says otherwise.
DELETE FROM "ReportSection" rs
USING "User" u, "Report" r
WHERE rs."authorId" = u.id
  AND rs."reportId" = r.id
  AND r."archived" = false
  AND u.role <> 'lead';
