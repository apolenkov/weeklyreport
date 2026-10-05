import { assertObservedRuntimeTarget } from "../../prisma/guards/_destructive-guard.js";
import { E2E_BASE_URL } from "./base-url.js";

const SCRIPT_NAME = "e2e-running-app-target";
// Through the web rewrite, so the web to API link the browser uses is probed.
export const RUNTIME_TARGET_URL = `${E2E_BASE_URL}/trpc/dev.runtimeTarget`;

type Fetch = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

function observedTarget(body: unknown): {
  database: string;
  redisDb: number;
} {
  const json = (body as { result?: { data?: { json?: unknown } } } | null)
    ?.result?.data?.json as { database?: unknown; redisDb?: unknown } | null;
  if (typeof json?.database !== "string" || typeof json.redisDb !== "number") {
    throw new TypeError(
      `[${SCRIPT_NAME}] ${RUNTIME_TARGET_URL} returned an unexpected body.`,
    );
  }
  return { database: json.database, redisDb: json.redisDb };
}

/**
 * Prove that the running app uses customreport_e2e and Redis DB 15. Runs in
 * global setup, before any scenario; `/health/ready` only proves connectivity.
 */
export async function assertRunningAppTarget(
  signal: AbortSignal,
  fetchImpl: Fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(RUNTIME_TARGET_URL, { signal });
  if (!response.ok) {
    throw new Error(
      `[${SCRIPT_NAME}] ${RUNTIME_TARGET_URL} answered HTTP ${response.status}. ` +
        "Start the app from current sources with AUTH_DEV_MODE=true.",
    );
  }
  assertObservedRuntimeTarget(
    SCRIPT_NAME,
    observedTarget(await response.json()),
  );
}
