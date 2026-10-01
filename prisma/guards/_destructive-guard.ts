// Boundary shim: the destructive-target contract is owned by
// apps/api/src/infrastructure/prisma/e2e-destructive-target.ts so production
// API sources (the dev-mode reseed router) can import the consent/target
// assertion without dragging the prisma/ tooling tree into the production
// Docker image — Dockerfile.api hygiene forbids guards/operations/seeds paths
// under /app/apps. This path is preserved for existing script and test
// importers; it also re-exports the Redis target contract (e2e-redis-target.ts).
export * from "../../apps/api/src/infrastructure/prisma/e2e-destructive-target.js";
export * from "../../apps/api/src/infrastructure/prisma/e2e-redis-target.js";
