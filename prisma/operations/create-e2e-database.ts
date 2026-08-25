import pg from "pg";

import {
  assertE2eRuntimeDestructiveTarget,
  type DestructiveTargetEnv,
  E2E_DATABASE_NAME,
  parseE2eRuntimeDatabaseTarget,
} from "../guards/_destructive-guard.js";
import { isEntrypoint } from "../guards/_entrypoint.js";
import { requireEnv } from "../guards/_require-env.js";

interface E2eDatabaseEnvironment extends DestructiveTargetEnv {
  readonly E2E_DATABASE_URL?: string;
}

const quoteIdentifier = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`;

const maintenanceUrlFor = (targetUrl: string): string => {
  const url = new URL(targetUrl);
  url.pathname = "/postgres";
  url.search = "";
  url.hash = "";
  return url.toString();
};

/** Create the exact disposable E2E database after the guard passes. */
export async function createE2eDatabase(
  environment: E2eDatabaseEnvironment = process.env,
): Promise<void> {
  const targetUrl = environment.E2E_DATABASE_URL;
  if (!targetUrl) {
    throw new Error(
      "[create-e2e-database] E2E_DATABASE_URL must be set before CREATE DATABASE.",
    );
  }

  assertE2eRuntimeDestructiveTarget(
    "create-e2e-database",
    targetUrl,
    environment,
  );
  const identity = parseE2eRuntimeDatabaseTarget(
    "create-e2e-database",
    targetUrl,
  );
  if (identity.database !== E2E_DATABASE_NAME) {
    throw new Error(
      `[create-e2e-database] CREATE DATABASE is reserved for ${E2E_DATABASE_NAME}.`,
    );
  }

  const client = new pg.Client({
    connectionString: maintenanceUrlFor(targetUrl),
  });
  await client.connect();
  try {
    const existing = await client.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname = $1",
      [E2E_DATABASE_NAME],
    );
    if (existing.rows[0] !== undefined) return;
    await client.query(`CREATE DATABASE ${quoteIdentifier(E2E_DATABASE_NAME)}`);
  } finally {
    await client.end();
  }
}

if (isEntrypoint(import.meta.url)) {
  void createE2eDatabase({
    ...process.env,
    E2E_DATABASE_URL: requireEnv("E2E_DATABASE_URL"),
  }).catch((error: unknown) => {
    console.error("[create-e2e-database] Failed:", error);
    process.exitCode = 1;
  });
}
