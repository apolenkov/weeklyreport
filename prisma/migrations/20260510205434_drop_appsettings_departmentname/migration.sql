-- UFB-047 / Phase 49-01: drop the legacy `AppSettings.departmentName`
-- column. Brand identity now lives on the `Organization` singleton
-- (seeded by the 20260510194118_organization_singleton migration); the
-- application-layer readers were rewired in this same plan to consume
-- `auth.me.organization` per request.
ALTER TABLE "AppSettings" DROP COLUMN "departmentName";
