import * as path from "node:path";

import { runtimeApiServerCwd } from "../../../runtime-api-server-command.ts";
import { sha256Hex } from "../../support/ids.ts";
import {
  type DetachedProcessGroupHandle,
  type ProcessGroupOwnership,
} from "../launch/bounded/preflight-detached-process-group.ts";
import {
  LOOPBACK_HOST,
  type PersistentServerLeaseServer,
  type PersistentServerName,
  PREFLIGHT_SERVER_LEASE_ATTEMPT_ENV,
  PREFLIGHT_SERVER_LEASE_CAMPAIGN_ENV,
  PREFLIGHT_SERVER_LEASE_ENV,
  PREFLIGHT_SERVER_LEASE_SHA_ENV,
  PREFLIGHT_SERVER_LEASE_SOURCE_TREE_ENV,
} from "./preflight-persistent-server-lease-contract.ts";
import { withoutLeaseEnvironment } from "./preflight-persistent-server-lease-environment.ts";
import { runtimeSweepWebEnvironment } from "./runtime-auth-env.ts";
import { runtimeTraceSamplingEnvironment } from "./runtime-observability-policy.ts";

export type PersistentServerLaunchEnvironment = Readonly<{
  readonly api: NodeJS.ProcessEnv;
  readonly web: NodeJS.ProcessEnv;
}>;

export type PersistentServerLaunchSpec = Readonly<{
  readonly name: PersistentServerName;
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly environment: NodeJS.ProcessEnv;
}>;

const SECRET_KEYS_NOT_NEEDED_BY_PREFLIGHT: ReadonlySet<string> = new Set([
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
]);

export const pnpmLauncherFor = (
  environment: NodeJS.ProcessEnv,
): Readonly<{
  readonly command: string;
  readonly leadingArgs: readonly string[];
}> => {
  const executable = environment.npm_execpath?.trim();
  if (!executable)
    throw new Error("Persistent server launcher requires npm_execpath");
  return /\.[cm]?js$/u.test(executable)
    ? { command: process.execPath, leadingArgs: [executable] }
    : { command: executable, leadingArgs: [] };
};

export const persistentServerEnvironmentsFor = (input: {
  readonly inherited: NodeJS.ProcessEnv;
  readonly archiveRoot: string;
  readonly apiPort: number;
  readonly webPort: number;
}): PersistentServerLaunchEnvironment => {
  const inherited = withoutLeaseEnvironment(input.inherited);
  const definedInherited = Object.fromEntries(
    Object.entries(inherited).filter(
      ([key, value]) =>
        value !== undefined && !SECRET_KEYS_NOT_NEEDED_BY_PREFLIGHT.has(key),
    ),
  ) as Record<string, string>;
  const webOrigin = `http://${LOOPBACK_HOST}:${String(input.webPort)}`;
  return {
    api: {
      ...definedInherited,
      PORT: String(input.apiPort),
      DATABASE_URL: input.inherited.E2E_DATABASE_URL,
      AUTH_DEV_MODE: "true",
      AUTH_JWT_SECRET:
        input.inherited.AUTH_JWT_SECRET ??
        "test-secret-must-be-32-chars-or-more!!",
      FRONTEND_URL: webOrigin,
      APP_BASE_URL: webOrigin,
      PDF_BASE_URL: webOrigin,
      PDF_OUTPUT_DIR: path.join(input.archiveRoot, "pdfs", "preflight"),
      PDF_EXPORT_JWT_SECRET:
        input.inherited.PDF_EXPORT_JWT_SECRET ??
        "pdf-export-secret-32-chars-minimum-for-tests!!",
      BULLMQ_PREFIX:
        input.inherited.E2E_BULLMQ_PREFIX ??
        `customreport-runtime-${String(process.pid)}-${String(Date.now())}`,
      REDIS_HOST: input.inherited.REDIS_HOST ?? "localhost",
      REDIS_PORT: input.inherited.REDIS_PORT ?? "6379",
      REDIS_MAXMEMORY_BYTES:
        input.inherited.REDIS_MAXMEMORY_BYTES ?? "209715200",
      NODE_ENV: "test",
      LOG_LEVEL: input.inherited.LOG_LEVEL ?? "info",
      LOG_DIR: path.join(input.archiveRoot, "api-log", "preflight"),
      RUNTIME_SWEEP_API_DRAIN: "true",
      OTEL_SDK_DISABLED: "false",
      ...runtimeTraceSamplingEnvironment,
      HEAP_HEALTH_THRESHOLD_BYTES:
        input.inherited.HEAP_HEALTH_THRESHOLD_BYTES ?? "1610612736",
    },
    web: {
      ...runtimeSweepWebEnvironment(definedInherited),
      NEXT_PUBLIC_API_URL: `http://${LOOPBACK_HOST}:${String(input.apiPort)}`,
      NODE_ENV: "test",
    },
  };
};

export const persistentServerLaunchSpecsFor = (input: {
  readonly repoRoot: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly servers: PersistentServerLaunchEnvironment;
  readonly apiPort: number;
  readonly webPort: number;
}): readonly [PersistentServerLaunchSpec, PersistentServerLaunchSpec] => {
  const launcher = pnpmLauncherFor(input.environment);
  const apiArgs = [
    "--env-file-if-exists=../../.env",
    "--import",
    "@swc-node/register/esm-register",
    "src/main.ts",
  ] as const;
  const webArgs = [
    ...launcher.leadingArgs,
    "--filter",
    "@customreport/web",
    "exec",
    "tsx",
    "e2e/runtime-sweep/preflight/run-runtime-next-server.ts",
    "preflight",
    String(input.webPort),
  ] as const;
  return [
    {
      name: "api",
      command: process.execPath,
      args: apiArgs,
      cwd: runtimeApiServerCwd,
      environment: input.servers.api,
    },
    {
      name: "web",
      command: launcher.command,
      args: webArgs,
      cwd: input.repoRoot,
      environment: input.servers.web,
    },
  ];
};

export const serverRecordFor = (input: {
  readonly name: PersistentServerName;
  readonly ownership: ProcessGroupOwnership;
  readonly port: number;
  readonly healthUrl: string;
  readonly cwd: string;
  readonly command: string;
  readonly args: readonly string[];
}): PersistentServerLeaseServer => {
  if (input.ownership.uid === undefined || input.ownership.startToken === "")
    throw new Error(
      `Persistent server ${input.name} launch ownership is incomplete`,
    );
  return Object.freeze({
    name: input.name,
    host: LOOPBACK_HOST,
    port: input.port,
    healthUrl: input.healthUrl,
    pid: input.ownership.pid,
    pgid: input.ownership.pgid,
    uid: input.ownership.uid,
    startToken: input.ownership.startToken,
    cwd: input.cwd,
    command: input.command,
    args: Object.freeze([...input.args]),
    commandDigest: sha256Hex({
      command: input.command,
      cwd: input.cwd,
      args: input.args,
    }),
  });
};

export const leaseEnvironmentFor = (input: {
  readonly path: string;
  readonly digest: string;
  readonly sourceTree: string;
  readonly campaignId: string;
  readonly attemptId: string;
}): NodeJS.ProcessEnv => ({
  [PREFLIGHT_SERVER_LEASE_ENV]: input.path,
  [PREFLIGHT_SERVER_LEASE_SHA_ENV]: input.digest,
  [PREFLIGHT_SERVER_LEASE_SOURCE_TREE_ENV]: input.sourceTree,
  [PREFLIGHT_SERVER_LEASE_CAMPAIGN_ENV]: input.campaignId,
  [PREFLIGHT_SERVER_LEASE_ATTEMPT_ENV]: input.attemptId,
});

export type PersistentServerGroup = Readonly<{
  readonly name: PersistentServerName;
  readonly handle: DetachedProcessGroupHandle;
}>;
