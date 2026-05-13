/**
 * C7 destructive-guard (UAT plan v7.2, 2026-05-12).
 *
 * Refuse to run scripts that wipe / reset / truncate data on a
 * production-looking environment. Layered check:
 *   1. NODE_ENV=production         → refuse
 *   2. DATABASE_URL not set        → refuse
 *   3. db name contains "prod"     → refuse (catches tunneled prod)
 *   4. host non-local AND name lacks non-prod suffix → refuse
 *
 * Allow rules:
 *   - host is localhost / 127.0.0.1 / postgres (docker) / *.local
 *     (impossible to reach prod through these)
 *   - OR db name explicitly suffixed _uat / _dev / _test / _local /
 *     _staging
 *
 * Override (e.g. prod data migration with backup):
 *   ALLOW_PROD_DESTRUCTIVE=yes pnpm db:reset:hard
 *
 * Underscore-prefixed file name → internal helper, not a Prisma seed file.
 */
export function assertNonProdDestructive(scriptName: string): void {
  if (process.env.ALLOW_PROD_DESTRUCTIVE === "yes") return;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `[${scriptName}] Refusing: NODE_ENV=production. ` +
        `Set ALLOW_PROD_DESTRUCTIVE=yes to override.`,
    );
  }

  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    throw new Error(
      `[${scriptName}] Refusing: DATABASE_URL not set. ` +
        `This script needs an explicit DB target.`,
    );
  }

  const lastSegment = (url.split("?")[0]?.split("/").pop() ?? "").toLowerCase();
  const host = url.replace(/.*@/, "").split(/[:/]/)[0]?.toLowerCase() ?? "";

  const refuse = (reason: string): never => {
    const masked = url.replace(/:[^:@]*@/, ":***@");
    throw new Error(
      `[${scriptName}] Refusing destructive op on DATABASE_URL=${masked}. ` +
        `${reason} Set ALLOW_PROD_DESTRUCTIVE=yes to override.`,
    );
  };

  // Hard refusal on prod-smelling DB name regardless of host
  // (catches tunneled / SSH-forwarded prod connections).
  if (/(^|[^a-z])(prod|production|live)([^a-z]|$)/i.test(lastSegment)) {
    refuse(`Database name "${lastSegment}" looks like production.`);
  }

  // "localhost" / "127.0.0.1" / "*.local" are physically unreachable from
  // production — allow unconditionally.
  // "postgres" (Docker Compose service name) is intentionally EXCLUDED: a
  // staging compose stack can use the same service name while pointing at
  // production data, so we require an explicit non-prod suffix for it.
  const isTrulyLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local");

  const isExplicitNonProdName = /_(uat|dev|test|local|staging)$/i.test(
    lastSegment,
  );

  // Truly local hosts are always safe.
  if (isTrulyLocal) return;
  // All other hosts (including docker-internal "postgres") must carry an
  // explicit non-prod suffix.
  if (isExplicitNonProdName) return;

  refuse(
    `Host "${host}" is not local and database "${lastSegment}" lacks ` +
      `non-prod suffix (_uat/_dev/_test/_local/_staging).`,
  );
}
