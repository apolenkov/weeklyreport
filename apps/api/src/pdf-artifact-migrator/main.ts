#!/usr/bin/env node
import {
  type MigratorConfig,
  MigratorConfigError,
  resolveConfig,
} from "./config.js";
import { connectReadOnlyClient, createRowSource } from "./db.js";
import { EXIT_REFUSED, type MigratorEvent, runMigrator } from "./migrator.js";

const emit = (event: MigratorEvent): void => {
  process.stdout.write(`${JSON.stringify(event)}\n`);
};

type Resolved =
  | { readonly ok: true; readonly config: MigratorConfig }
  | { readonly ok: false; readonly message: string };

const resolve = (): Resolved => {
  try {
    return { ok: true, config: resolveConfig(process.env) };
  } catch (error) {
    if (error instanceof MigratorConfigError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
};

const run = async (): Promise<number> => {
  const resolved = resolve();
  if (!resolved.ok) {
    emit({ type: "refusal", message: resolved.message });
    return EXIT_REFUSED;
  }
  const config = resolved.config;
  const outcome = await runMigrator(
    config,
    {
      openSource: async () =>
        createRowSource(await connectReadOnlyClient(config.databaseUrl)),
    },
    emit,
  );
  return outcome.exitCode;
};

run().then(
  (exitCode) => {
    process.exitCode = exitCode;
  },
  (error: unknown) => {
    emit({
      type: "refusal",
      message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = EXIT_REFUSED;
  },
);
