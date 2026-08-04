// Refuse wipe/reset on prod-looking DBs. Docker host `postgres` is not local —
// allow only when the db name carries a non-prod suffix (_uat/_dev/_test/…).
// Override: ALLOW_PROD_DESTRUCTIVE=yes. See openspec/specs/destructive-db-guard.
export interface DestructiveTargetEnv {
  readonly ALLOW_PROD_DESTRUCTIVE?: string;
  readonly DATABASE_URL?: string;
  readonly NODE_ENV?: string;
}

export function assertNonProdDestructiveTarget(
  scriptName: string,
  env: DestructiveTargetEnv,
): void {
  if (env.ALLOW_PROD_DESTRUCTIVE === "yes") return;

  if (env.NODE_ENV === "production") {
    throw new Error(
      `[${scriptName}] Refusing: NODE_ENV=production. ` +
        `Set ALLOW_PROD_DESTRUCTIVE=yes to override.`,
    );
  }

  const url: string = env.DATABASE_URL ?? "";
  if (!url) {
    throw new Error(
      `[${scriptName}] Refusing: DATABASE_URL not set. ` +
        `This script needs an explicit DB target.`,
    );
  }

  const refuse = (reason: string): never => {
    const masked = url.replace(/:[^:@]*@/, ":***@");
    throw new Error(
      `[${scriptName}] Refusing destructive op on DATABASE_URL=${masked}. ` +
        `${reason} Set ALLOW_PROD_DESTRUCTIVE=yes to override.`,
    );
  };

  const lastSegment = (url.split("?")[0]?.split("/").pop() ?? "").toLowerCase();
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      // A malformed URL must still surface the masked, actionable refusal,
      // not a raw TypeError leaking the unmasked connection string.
      return refuse("DATABASE_URL is not a parseable URL.");
    }
  })();

  // Hard refusal on prod-smelling DB name regardless of host
  // (catches tunneled / SSH-forwarded prod connections).
  if (/(^|[^a-z])(prod|production|live)([^a-z]|$)/i.test(lastSegment)) {
    refuse(`Database name "${lastSegment}" looks like production.`);
  }

  // localhost / 127.0.0.1 / *.local are physically unreachable from production.
  // The Docker service name "postgres" is deliberately excluded: a staging
  // compose stack can reuse it while pointing at production data.
  const isTrulyLocal =
    host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");

  const isExplicitNonProdName = /_(uat|dev|test|local|staging)$/i.test(
    lastSegment,
  );

  if (isTrulyLocal) return;
  if (isExplicitNonProdName) return;

  refuse(
    `Host "${host}" is not local and database "${lastSegment}" lacks ` +
      `non-prod suffix (_uat/_dev/_test/_local/_staging).`,
  );
}

export function assertNonProdDestructive(scriptName: string): void {
  assertNonProdDestructiveTarget(scriptName, process.env);
}
