import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const INIT_MIGRATION = "20260530162224_init";
const TARGET_ENVIRONMENTS = [
  "development",
  "test",
  "uat",
  "production",
] as const;

export type MigrationTargetEnvironment = (typeof TARGET_ENVIRONMENTS)[number];
export type InitMigrationState = "uninitialized" | "applied" | "incomplete";
export type InitMigrationAction =
  | "apply_edited_init"
  | "stop_for_additive_migration"
  | "stop_for_ledger_review";

export type InitMigrationDecision = Readonly<{
  action: InitMigrationAction;
  reason: string;
}>;

type MigrationRow = Readonly<{
  finished_at: Date | null;
  rolled_back_at: Date | null;
  applied_steps_count: number;
}>;

const requireEnvironment = (key: string): string => {
  const value = process.env[key];
  if (!value?.trim()) throw new Error(`${key} must be set explicitly.`);
  return value;
};

export function parseMigrationTargetEnvironment(
  value: string,
): MigrationTargetEnvironment {
  if ((TARGET_ENVIRONMENTS as readonly string[]).includes(value)) {
    return value as MigrationTargetEnvironment;
  }
  throw new Error(
    `MIGRATION_TARGET_ENV must be one of ${TARGET_ENVIRONMENTS.join(", ")}.`,
  );
}

export function decideInitMigrationAction(
  environment: MigrationTargetEnvironment,
  state: InitMigrationState,
): InitMigrationDecision {
  if (state === "incomplete") {
    return {
      action: "stop_for_ledger_review",
      reason:
        "The migration ledger contains an unfinished or rolled-back init migration.",
    };
  }
  if (environment === "production" && state === "applied") {
    return {
      action: "stop_for_additive_migration",
      reason:
        "Production already records the edited init migration; create and review an additive forward migration before deployment.",
    };
  }
  return {
    action: "apply_edited_init",
    reason:
      state === "uninitialized"
        ? "The target has no init migration ledger entry."
        : "The target is disposable; edited init history may be rebuilt with a reset.",
  };
}

const postgresErrorCode = (error: unknown): string | undefined => {
  if (!(error instanceof Error) || !("code" in error)) return undefined;
  const code = error.code;
  return typeof code === "string" ? code : undefined;
};

async function inspectInitMigration(
  pool: pg.Pool,
): Promise<InitMigrationState> {
  try {
    const result = await pool.query<MigrationRow>(
      `SELECT "finished_at", "rolled_back_at", "applied_steps_count"
       FROM "_prisma_migrations"
       WHERE "migration_name" = $1
       ORDER BY "started_at" DESC
       LIMIT 1`,
      [INIT_MIGRATION],
    );
    const migration = result.rows.at(0);
    if (!migration) return "uninitialized";
    return migration.finished_at !== null &&
      migration.rolled_back_at === null &&
      migration.applied_steps_count > 0
      ? "applied"
      : "incomplete";
  } catch (error: unknown) {
    if (postgresErrorCode(error) === "42P01") return "uninitialized";
    throw error;
  }
}

async function main(): Promise<void> {
  const databaseUrl = requireEnvironment("DATABASE_URL");
  const environment = parseMigrationTargetEnvironment(
    requireEnvironment("MIGRATION_TARGET_ENV"),
  );
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const state = await inspectInitMigration(pool);
    const decision = decideInitMigrationAction(environment, state);
    console.log(
      JSON.stringify({
        migration: INIT_MIGRATION,
        targetEnvironment: environment,
        state,
        ...decision,
      }),
    );
    if (decision.action !== "apply_edited_init") {
      throw new Error(decision.reason);
    }
  } finally {
    await pool.end();
  }
}

const [entrypoint] = process.argv.slice(1);
const isMain = entrypoint
  ? resolve(entrypoint) === fileURLToPath(import.meta.url)
  : false;

if (isMain) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error.";
    console.error(`[check-init-migration-target] ${message}`);
    process.exitCode = 1;
  });
}
