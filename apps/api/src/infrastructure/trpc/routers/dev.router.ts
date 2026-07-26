import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { MS_PER_MINUTE } from "@customreport/shared";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { errorMessage } from "../../../lib/error-message.js";
import type { EnvConfig } from "../../config/env.schema";
import {
  protectedProcedure,
  publicProcedure,
  router,
} from "../trpc.middleware.js";

// wipeAndReseed: child-process timeout per seed tier — larger tiers write
// more rows and need more wall-clock room.
const MANUAL_UAT_RESEED_TIMEOUT_MINUTES = 1;
const HUGE_RESEED_TIMEOUT_MINUTES = 5;
const DEFAULT_RESEED_TIMEOUT_MINUTES = 2;
const MANUAL_UAT_RESEED_TIMEOUT_MS =
  MANUAL_UAT_RESEED_TIMEOUT_MINUTES * MS_PER_MINUTE;
const HUGE_RESEED_TIMEOUT_MS = HUGE_RESEED_TIMEOUT_MINUTES * MS_PER_MINUTE;
const DEFAULT_RESEED_TIMEOUT_MS =
  DEFAULT_RESEED_TIMEOUT_MINUTES * MS_PER_MINUTE;
const RESEED_OUTPUT_TAIL_LINES = 15;
const RESEED_STDERR_TAIL_LENGTH = 500;
const RESEED_VARIANT_MANUAL_UAT = "manual-uat";
// Prisma AI consent gate expects this Russian yes; any other value aborts reset.
const PRISMA_AI_DANGEROUS_ACTION_CONSENT = "давай";

export interface DevRouterDeps {
  prisma: PrismaClient;
  // Validated env from main.ts — dev-mode gate + reseed root override, so
  // neither reads raw process.env.
  env: EnvConfig;
}

type ReseedVariant =
  "small" | "middle" | "huge" | typeof RESEED_VARIANT_MANUAL_UAT;

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

// Tiers mirror package.json seed scripts; reset applies migrations, then seed.
const buildReseedScript = (variant: ReseedVariant): string => {
  if (variant === RESEED_VARIANT_MANUAL_UAT) {
    return "pnpm --dir apps/api exec tsx ../../prisma/wipe-manual-uat.ts";
  }
  const reset = "pnpm exec prisma migrate reset --force";
  const seed =
    variant === "middle"
      ? "pnpm --dir apps/api exec tsx ../../prisma/seed-simple.ts"
      : `pnpm --dir apps/api exec tsx ../../prisma/seed-demo.ts ${variant}`;
  return `${reset} && ${seed}`;
};

const reseedTimeoutMs = (variant: ReseedVariant): number => {
  if (variant === RESEED_VARIANT_MANUAL_UAT)
    return MANUAL_UAT_RESEED_TIMEOUT_MS;
  return variant === "huge"
    ? HUGE_RESEED_TIMEOUT_MS
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

    // Any authenticated role may reset demo data — this is a dev-only test
    // affordance (double-gated: dev router mount + the AUTH_DEV_MODE check),
    // not a production admin capability.
    wipeAndReseed: protectedProcedure
      .input(
        z.object({
          variant: z
            .enum(["small", "middle", "huge", RESEED_VARIANT_MANUAL_UAT])
            .default("small"),
        }),
      )
      .mutation(({ input }) => {
        assertDevMode(deps.env);
        // Run Prisma reset as a child process so "wipe & reseed" is a
        // real clean-slate operation in Docker too.
        const repoRoot = resolveRepoRoot(deps.env.CUSTOMREPORT_REPO_ROOT);
        try {
          // eslint-disable-next-line sonarjs/os-command -- dev-only reseed, double-gated by router mount + assertDevMode; the command string is assembled solely from z.enum-validated literals, no user text
          const stdout = execSync(buildReseedScript(input.variant), {
            cwd: repoRoot,
            encoding: "utf8",
            env: {
              ...process.env,
              PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION:
                PRISMA_AI_DANGEROUS_ACTION_CONSENT,
            },
            timeout: reseedTimeoutMs(input.variant),
          });
          return {
            ok: true,
            variant: input.variant,
            output: stdout
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
