import { execFileSync } from "node:child_process";

import {
  assertPersistentServerLeaseIdentity,
  type PersistentServerLease,
  type PersistentServerLeaseExpected,
  type PersistentServerLeaseFile,
  type PersistentServerLeaseProbe,
  type PersistentServerLeaseServer,
  readPersistentServerLease,
} from "./preflight-persistent-server-lease-contract.ts";

const HEALTH_REQUEST_TIMEOUT_MS = 2000;
const HEALTH_POLL_MS = 250;
const NO_RESIDUE_TIMEOUT_MS = 5000;
const PROCESS_COLUMNS = 4;
const PGID_FIELD_INDEX = 1;
const UID_FIELD_INDEX = 2;
const START_TOKEN_FIELD_INDEX = 3;
const PROCESS_PROBE_TIMEOUT_MS = 500;
const BYTES_PER_KIBIBYTE = 1024;
const PROCESS_PROBE_KIBIBYTES = 128;
const PROCESS_PROBE_MAX_BYTES = PROCESS_PROBE_KIBIBYTES * BYTES_PER_KIBIBYTE;
const LISTENER_PROBE_TIMEOUT_MS = 1000;
const LISTENER_PROBE_KIBIBYTES = 16;
const LISTENER_PROBE_MAX_BYTES = LISTENER_PROBE_KIBIBYTES * BYTES_PER_KIBIBYTE;

type ProcessSnapshot = Readonly<{
  readonly pid: number;
  readonly pgid: number;
  readonly uid: number;
  readonly startToken: string;
}>;

const processSnapshotFor = (pid: number): ProcessSnapshot => {
  const output = execFileSync(
    "/bin/ps",
    ["-p", String(pid), "-o", "pid=,pgid=,uid=,lstart="],
    {
      encoding: "utf8",
      timeout: PROCESS_PROBE_TIMEOUT_MS,
      maxBuffer: PROCESS_PROBE_MAX_BYTES,
    },
  ).trim();
  const fields = output.split(/\s+/u);
  if (fields.length < PROCESS_COLUMNS)
    throw new Error(
      `Persistent server pid=${String(pid)} identity is unavailable`,
    );
  const snapshot = {
    pid: Number(fields[0]),
    pgid: Number(fields[PGID_FIELD_INDEX]),
    uid: Number(fields[UID_FIELD_INDEX]),
    startToken: fields.slice(START_TOKEN_FIELD_INDEX).join(" "),
  };
  if (
    !Number.isSafeInteger(snapshot.pid) ||
    !Number.isSafeInteger(snapshot.pgid) ||
    !Number.isSafeInteger(snapshot.uid) ||
    snapshot.startToken === ""
  )
    throw new Error(`Persistent server pid=${String(pid)} identity is invalid`);
  return snapshot;
};

export const assertPersistentServerProcessGroupLive = (
  server: PersistentServerLeaseServer,
): void => {
  try {
    process.kill(-server.pgid, 0);
    process.kill(server.pid, 0);
  } catch (error: unknown) {
    const code =
      error instanceof Error && "code" in error ? String(error.code) : "";
    throw new Error(
      `Persistent server ${server.name} process group is not provably live (${code || String(error)})`,
      { cause: error },
    );
  }
  const leader = processSnapshotFor(server.pid);
  if (
    leader.pid !== server.pid ||
    leader.pgid !== server.pgid ||
    leader.uid !== server.uid ||
    leader.startToken !== server.startToken
  )
    throw new Error(`Persistent server ${server.name} leader identity changed`);
  const members = execFileSync("/bin/ps", ["-axo", "pid=,pgid=,uid=,lstart="], {
    encoding: "utf8",
    timeout: PROCESS_PROBE_TIMEOUT_MS,
    maxBuffer: PROCESS_PROBE_MAX_BYTES,
  })
    .split("\n")
    .map((line) => line.trim().split(/\s+/u))
    .filter((fields) => fields.length >= PROCESS_COLUMNS)
    .map((fields) => ({
      pid: Number(fields[0]),
      pgid: Number(fields[PGID_FIELD_INDEX]),
      uid: Number(fields[UID_FIELD_INDEX]),
      startToken: fields.slice(START_TOKEN_FIELD_INDEX).join(" "),
    }))
    .filter((member) => member.pgid === server.pgid);
  if (
    !members.some(
      (member) =>
        member.pid === server.pid && member.startToken === server.startToken,
    ) ||
    members.some((member) => member.uid !== server.uid)
  )
    throw new Error(
      `Persistent server ${server.name} group ownership is not proven`,
    );
};

const listenerPidsFor = (
  server: PersistentServerLeaseServer,
): readonly number[] => {
  const output = execFileSync(
    "/usr/sbin/lsof",
    ["-nP", "-a", `-iTCP:${String(server.port)}`, "-sTCP:LISTEN", "-Fp"],
    {
      encoding: "utf8",
      timeout: LISTENER_PROBE_TIMEOUT_MS,
      maxBuffer: LISTENER_PROBE_MAX_BYTES,
    },
  );
  const pids = output
    .split("\n")
    .filter((line) => line.startsWith("p"))
    .map((line) => Number(line.slice(1)))
    .filter((pid) => Number.isSafeInteger(pid) && pid > 0);
  if (pids.length === 0)
    throw new Error(
      `Persistent server ${server.name} has no proven listener on port ${String(server.port)}`,
    );
  return [...new Set(pids)];
};

export const assertPersistentServerListenerOwned = (
  server: PersistentServerLeaseServer,
): void => {
  for (const pid of listenerPidsFor(server)) {
    const listener = processSnapshotFor(pid);
    if (listener.pgid !== server.pgid || listener.uid !== server.uid)
      throw new Error(`Persistent server ${server.name} listener is foreign`);
  }
};

export const assertPersistentServerHealthy = async (
  server: PersistentServerLeaseServer,
  signal?: AbortSignal,
): Promise<void> => {
  throwIfAborted(signal);
  try {
    const requestSignal =
      signal === undefined
        ? AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS)
        : AbortSignal.any([
            AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS),
            signal,
          ]);
    const response = await fetch(server.healthUrl, {
      signal: requestSignal,
    });
    if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
  } catch (error: unknown) {
    if (signal?.aborted)
      throw signal.reason ?? new Error("Health check aborted");
    throw new Error(`Persistent server ${server.name} health check failed`, {
      cause: error,
    });
  }
};

const defaultProbe: Required<PersistentServerLeaseProbe> = {
  processGroup: assertPersistentServerProcessGroupLive,
  listener: assertPersistentServerListenerOwned,
  health: assertPersistentServerHealthy,
};

export const assertPersistentServerLease = async (input: {
  readonly path: string;
  readonly digest: string;
  readonly expected: PersistentServerLeaseExpected;
  readonly probe?: PersistentServerLeaseProbe;
}): Promise<PersistentServerLease> => {
  const file = await readPersistentServerLease(input);
  assertPersistentServerLeaseIdentity(file.lease, input.expected);
  const probe = { ...defaultProbe, ...input.probe };
  for (const server of file.lease.servers) {
    probe.processGroup(server);
    probe.listener(server);
    await probe.health(server);
  }
  return file.lease;
};

export const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted)
    throw signal.reason ?? new Error("Persistent server startup aborted");
};

const waitForHealthDelay = (
  delayMs: number,
  signal?: AbortSignal,
): Promise<void> => {
  if (signal === undefined)
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  throwIfAborted(signal);
  return new Promise<void>((resolve, reject) => {
    const state = { settled: false };
    const settle = (failure?: unknown): void => {
      if (state.settled) return;
      state.settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      if (failure === undefined) resolve();
      else reject(failure);
    };
    const onAbort = (): void =>
      settle(signal.reason ?? new Error("Persistent server startup aborted"));
    const timer = setTimeout(() => settle(), delayMs);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
};

const waitForHealth = async (
  server: PersistentServerLeaseServer,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<void> => {
  throwIfAborted(signal);
  const deadline = Date.now() + timeoutMs;
  const state: { lastError?: unknown } = {};
  while (Date.now() < deadline) {
    throwIfAborted(signal);
    try {
      await assertPersistentServerHealthy(server, signal);
      return;
    } catch (error: unknown) {
      throwIfAborted(signal);
      state.lastError = error;
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) break;
      await waitForHealthDelay(Math.min(HEALTH_POLL_MS, remainingMs), signal);
    }
  }
  throwIfAborted(signal);
  throw new Error(`Persistent server ${server.name} did not become healthy`, {
    cause: state.lastError,
  });
};

export const waitForPersistentServerHealth = waitForHealth;

const listenerGone = (server: PersistentServerLeaseServer): boolean => {
  try {
    return listenerPidsFor(server).length === 0;
  } catch (error: unknown) {
    const code =
      error instanceof Error && "code" in error ? String(error.code) : "";
    const status =
      error instanceof Error &&
      "status" in error &&
      typeof error.status === "number"
        ? error.status
        : undefined;
    if (
      code === "1" ||
      status === 1 ||
      (error instanceof Error && /no proven listener/u.test(error.message))
    )
      return true;
    throw error;
  }
};

export const waitForPersistentServerNoResidue = async (
  server: PersistentServerLeaseServer,
): Promise<void> => {
  const deadline = Date.now() + NO_RESIDUE_TIMEOUT_MS;
  const state: { lastError?: unknown } = {};
  while (Date.now() < deadline) {
    const groupGone = processGroupGone(server);
    if (groupGone && listenerGone(server)) return;
    if (!groupGone) state.lastError = new Error("process group is still live");
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_MS));
  }
  throw new Error(`Persistent server ${server.name} left runtime residue`, {
    cause: state.lastError,
  });
};

const processGroupGone = (server: PersistentServerLeaseServer): boolean => {
  try {
    process.kill(-server.pgid, 0);
    return false;
  } catch (error: unknown) {
    const code =
      error instanceof Error && "code" in error ? String(error.code) : "";
    if (code === "ESRCH") return true;
    throw error;
  }
};

export const assertPersistentServerLeaseFile = async (input: {
  readonly path: string;
  readonly digest: string;
  readonly expected: PersistentServerLeaseExpected;
}): Promise<PersistentServerLeaseFile> => {
  const file = await readPersistentServerLease(input);
  assertPersistentServerLeaseIdentity(file.lease, input.expected);
  return file;
};
