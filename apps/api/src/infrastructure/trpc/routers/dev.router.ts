import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  MS_PER_MINUTE,
  type ReseedVariant,
  reseedVariantSchema,
} from "@customreport/shared";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { assertE2eRuntimeDestructiveTarget } from "../../../../../../prisma/guards/_destructive-guard.js";
import { errorMessage } from "../../../lib/error-message.js";
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
const RESEED_OUTPUT_TAIL_LINES = 15;
const RESEED_STDERR_TAIL_LENGTH = 500;

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

const extractStderr = (error: unknown): string => {
  const stderrRaw =
    error instanceof Error && "stderr" in error
      ? (error as { stderr?: unknown }).stderr
      : undefined;
  if (typeof stderrRaw === "string") return stderrRaw;
  return Buffer.isBuffer(stderrRaw) ? stderrRaw.toString("utf8") : "";
};

const toReseedError = (error: unknown): TRPCError =>
  new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Reseed failed: ${errorMessage(error)}\n${extractStderr(error).slice(-RESEED_STDERR_TAIL_LENGTH)}`,
    cause: error instanceof Error ? error : undefined,
  });

export function createDevRouter(deps: DevRouterDeps) {
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
      .mutation(({ input }) => {
        assertDevMode(deps.env);
        // Run Prisma reset as a child process so "wipe & reseed" is a
        // real clean-slate operation in Docker too.
        const repoRoot = resolveRepoRoot(deps.env.CUSTOMREPORT_REPO_ROOT);
        // The canonical destructive guard runs immediately before the first
        // child process: it refuses a non-disposable target or a run without the
        // operator's per-run consent. Consent is read from the operator's
        // environment and never injected here.
        assertE2eRuntimeDestructiveTarget(
          "dev-reseed",
          deps.env.DATABASE_URL,
          process.env,
        );
        try {
          const options = {
            cwd: repoRoot,
            encoding: "utf8",
            env: process.env,
            timeout: reseedTimeoutMs(input.variant),
          } as const;
          const resetOutput = execFileSync(
            resolveExecutable("pnpm"),
            ["exec", "prisma", "migrate", "reset", "--force"],
            options,
          );
          const seedOutput = execFileSync(
            resolveExecutable("pnpm"),
            ["db:seed:profile", input.variant],
            options,
          );
          return {
            ok: true,
            variant: input.variant,
            output: `${resetOutput}\n${seedOutput}`
              .split("\n")
              .slice(-RESEED_OUTPUT_TAIL_LINES)
              .join("\n"),
          };
        } catch (error) {
          throw toReseedError(error);
        }
      }),
  });
}
