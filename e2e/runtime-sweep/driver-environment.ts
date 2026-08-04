import { execFileSync } from "node:child_process";
import path from "node:path";

import { DriverAssignmentError } from "./driver-errors.ts";

const LIVE_PROBE_TIMEOUT_MS = 5000;
const HTTP_SUCCESS_MIN = 200;
const HTTP_SUCCESS_MAX = 400;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export interface DriveEnvironment {
  readonly archive: string;
  readonly baseURL: string;
  readonly databaseUrl: string;
  readonly repoRoot: string;
  readonly sourceSha: string;
}

export type RuntimeSweepLiveProbe = (baseURL: string) => Promise<number>;

export function requireRuntimeSweepBaseURL(value?: string): string {
  const candidate = value?.trim();
  if (!candidate)
    throw new DriverAssignmentError("RUNTIME_SWEEP_BASE_URL is required");
  const parsed = parseRuntimeSweepBaseURL(candidate);
  const hostname = parsed.hostname.replaceAll(/^\[|\]$/g, "").toLowerCase();
  if (!LOOPBACK_HOSTS.has(hostname))
    throw new DriverAssignmentError(
      "RUNTIME_SWEEP_BASE_URL must target a loopback host",
    );
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    throw new DriverAssignmentError(
      "RUNTIME_SWEEP_BASE_URL must use http or https",
    );
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname !== "" && parsed.pathname !== "/") ||
    candidate.endsWith("/")
  )
    throw new DriverAssignmentError(
      "RUNTIME_SWEEP_BASE_URL must be a bare loopback origin without credentials or a path",
    );
  return candidate;
}

function parseRuntimeSweepBaseURL(candidate: string): URL {
  try {
    return new URL(candidate);
  } catch (error) {
    if (error instanceof TypeError)
      throw new DriverAssignmentError(
        "RUNTIME_SWEEP_BASE_URL must be an absolute loopback URL",
      );
    throw error;
  }
}

async function probeRuntimeSweepBaseURL(baseURL: string): Promise<number> {
  const response = await fetch(baseURL, {
    redirect: "manual",
    signal: AbortSignal.timeout(LIVE_PROBE_TIMEOUT_MS),
  });
  return response.status;
}

export async function assertRuntimeSweepBaseURLLive(
  value: string | undefined,
  probe: RuntimeSweepLiveProbe = probeRuntimeSweepBaseURL,
): Promise<string> {
  const baseURL = requireRuntimeSweepBaseURL(value);
  const status = await probe(baseURL).catch((error: unknown) => {
    if (error instanceof Error)
      throw new DriverAssignmentError(
        `RUNTIME_SWEEP_BASE_URL is not live: ${error.message}`,
      );
    throw error;
  });
  if (status < HTTP_SUCCESS_MIN || status >= HTTP_SUCCESS_MAX)
    throw new DriverAssignmentError(
      `RUNTIME_SWEEP_BASE_URL is not live: HTTP ${status}`,
    );
  return baseURL;
}

export function requireDriverEnvironment(
  repoRoot: string,
  baseURLOverride?: string,
): DriveEnvironment {
  const archive = process.env.RUNTIME_SWEEP_ARCHIVE;
  const databaseUrl = process.env.E2E_DATABASE_URL;
  const sourceSha = process.env.RUNTIME_SWEEP_SOURCE_SHA;
  if (!archive || !databaseUrl || !sourceSha)
    throw new DriverAssignmentError(
      "RUNTIME_SWEEP_ARCHIVE, RUNTIME_SWEEP_SOURCE_SHA, E2E_DATABASE_URL, and RUNTIME_SWEEP_BASE_URL are required",
    );
  const baseURL = requireRuntimeSweepBaseURL(
    baseURLOverride ?? process.env.RUNTIME_SWEEP_BASE_URL,
  );
  const head = execFileSync("/usr/bin/git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  const status = execFileSync("/usr/bin/git", ["status", "--porcelain"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  if (head !== sourceSha || status !== "")
    throw new DriverAssignmentError(
      "Runtime sweep requires the declared clean source SHA",
    );
  return {
    archive: path.resolve(archive),
    baseURL,
    databaseUrl,
    repoRoot,
    sourceSha,
  };
}
