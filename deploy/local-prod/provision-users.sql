-- LOCAL STAND-IN role assignment. SAML never carries a role: a first login
-- creates a viewer, and an existing User row is never re-synced from the IdP
-- (apps/api/src/modules/auth/user-session.ts). Pre-provisioning the rows makes
-- roles reproducible: `samlId` must equal the SAML NameID, which the realm
-- template sets to the e-mail. Non-viewers must own a ReportingGroup.
-- Idempotent; run after the first successful `helm install` (schema exists):
--   kubectl -n wr-local-prod exec -i statefulset/postgres -- \
--     psql -U weeklyreport -d weeklyreport_production -v ON_ERROR_STOP=1 < provision-users.sql
INSERT INTO "ReportingGroup" (id, name, "updatedAt")
SELECT '00000000-0000-4000-8000-0000000000a1', 'Local stand', now()
WHERE NOT EXISTS (SELECT 1 FROM "ReportingGroup" WHERE id = '00000000-0000-4000-8000-0000000000a1');

INSERT INTO "User" (id, email, name, "lastName", "firstName", role, "samlId", "reportingGroupId", "updatedAt")
VALUES
  ('00000000-0000-4000-8000-0000000000b1', 'lead1@weeklyreport.local',  'Lead One',        'Lead One',        ' ', 'lead',   'lead1@weeklyreport.local',  '00000000-0000-4000-8000-0000000000a1', now()),
  ('00000000-0000-4000-8000-0000000000b2', 'head@weeklyreport.local',   'Department Head', 'Department Head', ' ', 'head',   'head@weeklyreport.local',   '00000000-0000-4000-8000-0000000000a1', now()),
  ('00000000-0000-4000-8000-0000000000b3', 'viewer@weeklyreport.local', 'Viewer',          'Viewer',          ' ', 'viewer', 'viewer@weeklyreport.local', NULL, now()),
  ('00000000-0000-4000-8000-0000000000b4', 'admin@weeklyreport.local',  'Admin',           'Admin',           ' ', 'admin',  'admin@weeklyreport.local',  '00000000-0000-4000-8000-0000000000a1', now())
ON CONFLICT (email) DO UPDATE
  SET role = EXCLUDED.role, "reportingGroupId" = EXCLUDED."reportingGroupId", "updatedAt" = now();

UPDATE "ReportingGroup" SET "headUserId" = '00000000-0000-4000-8000-0000000000b2'
WHERE id = '00000000-0000-4000-8000-0000000000a1' AND "headUserId" IS NULL;
