import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { promisify } from "node:util";

import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  MS_PER_MINUTE,
  type ReseedVariant,
  reseedVariantSchema,
} from "@weeklyreport/shared";
import { z } from "zod";

import type { EnvConfig } from "../../config/env.schema";
import { assertE2eRuntimeDestructiveTarget } from "../../prisma/e2e-destructive-target.js";
import {
  captureMutationAuditInputMiddleware,
  protectedProcedure,
  publicProcedure,
  router,
} from "../trpc.middleware.js";

// wipeAndReseed: child-process timeout per seed profile — stress writes
// more rows and need more wall-clock room.
const STRESS_RESEED_TIMEOUT_MINUTES = 5;
const DEFAULT_RESEED_TIMEOUT_MINUTES = 2;
const STRESS_RESEED_TIMEOUT_MS = STRESS_RESEED_TIMEOUT_MINUTES * MS_PER_MINUTE;
const DEFAULT_RESEED_TIMEOUT_MS =
  DEFAULT_RESEED_TIMEOUT_MINUTES * MS_PER_MINUTE;
// Async so a multi-minute reset never blocks the API event loop.
const execFileAsync = promisify(execFile);

export interface DevRouterDeps {
  prisma: PrismaClient;
  // Validated env from main.ts — dev-mode gate + reseed root override, so
  // neither reads raw process.env.
  env: EnvConfig;
}

// Refuse unless AUTH_DEV_MODE so an accidental prod deploy cannot wipe data.
// Reads the validated env (boolean post-transform), never raw process.env.
const assertDevMode = (env: EnvConfig): void => {
  if (!env.AUTH_DEV_MODE) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Dev mode is not enabled",
    });
  }
};

const resolveExecutable = (command: string): string => {
  const searchPath = process.env.PATH;
  if (searchPath === undefined) {
    throw new Error(`PATH is required to resolve ${command}`);
  }
  const executable = searchPath
    .split(path.delimiter)
    .map((directory) => path.join(directory, command))
    .find(fs.existsSync);
  if (executable === undefined) {
    throw new Error(`${command} is required for dev reseeding`);
  }
  return executable;
};

const reseedTimeoutMs = (variant: ReseedVariant): number => {
  return variant === "stress"
    ? STRESS_RESEED_TIMEOUT_MS
    : DEFAULT_RESEED_TIMEOUT_MS;
};

// Built Docker paths nest under dist/... so a fixed hop from import.meta.url
// can miss the repo root; prefer cwd/workspace and verify via schema.prisma.
const resolveRepoRoot = (envRoot: string | undefined): string => {
  const moduleDir = path.dirname(url.fileURLToPath(import.meta.url));
  const candidates = [
    envRoot,
    process.cwd(),
    path.resolve(process.cwd(), "../.."),
    path.resolve(moduleDir, "../../../../../.."),
  ].filter((candidate): candidate is string => Boolean(candidate));
  const repoRoot = candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "prisma/schema.prisma")),
  );
  if (!repoRoot) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Reseed failed: repository root was not found",
    });
  }
  return repoRoot;
};

export function createDevRouter(deps: DevRouterDeps) {
  // ponytail: per-process flag; a multi-replica dev stack would need a DB lock.
  const reseed = { inFlight: false };
  return router({
    // Lists every seeded user so a dev-mode login picker can show all of
    // them (not just the 3 hardcoded role buckets). publicProcedure so
    // the picker works before any session exists.
    listUsers: publicProcedure.query(async () => {
      assertDevMode(deps.env);
      const users = await deps.prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      });
      return users;
    }),

    // Lets the E2E setup observe what this process is actually connected to:
    // the database name comes from the live connection, and every Redis client
    // reads REDIS_DB through buildRedisConnectionOptions. No host or credentials.
    // ponytail: config-level Redis signal; upgrade to CLIENT INFO if insufficient.
    runtimeTarget: publicProcedure.query(async () => {
      assertDevMode(deps.env);
      const rows = await deps.prisma.$queryRaw<
        { database: string }[]
      >`SELECT current_database() AS database`;
      const database = rows[0]?.database;
      if (database === undefined) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database did not report its name",
        });
      }
      return { database, redisDb: deps.env.REDIS_DB };
    }),

    // Dev-only test affordance guarded by AUTH_DEV_MODE at execution. Variant
    // is required because a wipe is too destructive to run on an implicit
    // default an operator did not choose.
    wipeAndReseed: protectedProcedure
      .input(
        z.object({
          variant: reseedVariantSchema,
        }),
      )
      .use(captureMutationAuditInputMiddleware)
      .mutation(async ({ input }) => {
        assertDevMode(deps.env);
        // Run Prisma reset as a child process so "wipe & reseed" is a
        // real clean-slate operation in Docker too.
        const repoRoot = resolveRepoRoot(deps.env.WEEKLYREPORT_REPO_ROOT);
        // The canonical destructive guard runs immediately before the first
        // child process: it refuses a non-disposable target or a run without the
        // operator's per-run consent. Consent is read from the operator's
        // environment and never injected here.
        assertE2eRuntimeDestructiveTarget(
          "dev-reseed",
          deps.env.DATABASE_URL,
          process.env,
        );
        if (reseed.inFlight) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A wipe and reseed is already running",
          });
        }
        reseed.inFlight = true;
        try {
          const options = {
            cwd: repoRoot,
            encoding: "utf8",
            env: process.env,
            timeout: reseedTimeoutMs(input.variant),
          } as const;
          await execFileAsync(
            resolveExecutable("pnpm"),
            ["exec", "prisma", "migrate", "reset", "--force"],
            options,
          );
          await execFileAsync(
            resolveExecutable("pnpm"),
            ["db:seed:profile", input.variant],
            options,
          );
          return {
            ok: true,
            variant: input.variant,
            output: "Reseed completed",
          };
        } catch {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Reseed failed",
          });
        } finally {
          reseed.inFlight = false;
        }
      }),
  });
}
