import { type ChildProcess, execFileSync } from "node:child_process";

const PS = "/bin/ps";
const OWNERSHIP_PROBE_TIMEOUT_MS = 250;
const KIBIBYTES = 1024;
const MAX_OWNERSHIP_PROBE_KIBIBYTES = 64;
const OWNERSHIP_PROBE_MAX_BYTES = MAX_OWNERSHIP_PROBE_KIBIBYTES * KIBIBYTES;

export type ProcessGroupCleanupClassification =
  "CLEAN" | "ESRCH_ALREADY_GONE" | "EPERM_OWNED_LIVE" | "OWNERSHIP_UNPROVEN";

export type ProcessGroupOwnership = Readonly<{
  readonly pid: number;
  readonly pgid: number;
  readonly uid?: number;
  /** Opaque launch token; it is never accepted as an OS identity by itself. */
  readonly startToken: string;
}>;

export class ProcessGroupCleanupError extends Error {
  override readonly name = "ProcessGroupCleanupError";

  constructor(
    readonly operationName: string,
    readonly classification: Exclude<
      ProcessGroupCleanupClassification,
      "CLEAN"
    >,
    detail: string,
  ) {
    super(
      `${operationName} process-group cleanup ${classification}: ${detail}`,
    );
  }
}

export type ProcessGroupLeaderOwnership = "LIVE" | "GONE" | "UNPROVEN";
export type ProcessGroupMemberOwnership = "OWNED" | "FOREIGN" | "UNPROVEN";

type ProcessGroupStatus = "LIVE" | "GONE";

const errorCodeFor = (error: unknown): string | undefined =>
  error instanceof Error && "code" in error ? String(error.code) : undefined;

const isMissingProcess = (error: unknown): boolean =>
  errorCodeFor(error) === "ESRCH";

const isPermissionDenied = (error: unknown): boolean =>
  errorCodeFor(error) === "EPERM";

const childIsRunning = (child: ChildProcess): boolean =>
  child.exitCode === null && child.signalCode === null;

const processStartTokenFor = (pid: number): string | undefined => {
  try {
    const token = execFileSync(PS, ["-p", String(pid), "-o", "lstart="], {
      encoding: "utf8",
      timeout: OWNERSHIP_PROBE_TIMEOUT_MS,
      maxBuffer: 2000,
    }).trim();
    return token.length > 0 ? token : undefined;
  } catch (error: unknown) {
    if (error instanceof Error) return undefined;
    throw error;
  }
};

export const groupOwnershipFor = (input: {
  readonly operationName: string;
  readonly ownership: ProcessGroupOwnership;
}): ProcessGroupMemberOwnership => {
  if (input.ownership.uid === undefined || input.ownership.startToken === "")
    return "UNPROVEN";
  try {
    const raw = execFileSync(PS, ["-axo", "pid=,pgid=,uid="], {
      encoding: "utf8",
      timeout: OWNERSHIP_PROBE_TIMEOUT_MS,
      maxBuffer: OWNERSHIP_PROBE_MAX_BYTES,
    });
    const members = raw
      .split("\n")
      .map((line) => line.trim().split(/\s+/u))
      .map(([pidText, pgidText, uidText]) => ({
        pid: Number(pidText),
        pgid: Number(pgidText),
        uid: Number(uidText),
      }))
      .filter(
        (member) =>
          Number.isSafeInteger(member.pid) &&
          Number.isSafeInteger(member.pgid) &&
          Number.isSafeInteger(member.uid) &&
          member.pgid === input.ownership.pgid,
      );
    if (
      !members.some((member) => member.pid === input.ownership.pid) ||
      processStartTokenFor(input.ownership.pid) !== input.ownership.startToken
    )
      return "UNPROVEN";
    return members.every((member) => member.uid === input.ownership.uid)
      ? "OWNED"
      : "FOREIGN";
  } catch (error: unknown) {
    if (error instanceof Error) return "UNPROVEN";
    throw new ProcessGroupCleanupError(
      input.operationName,
      "OWNERSHIP_UNPROVEN",
      `ownership probe failed: ${String(error)}`,
    );
  }
};

export const classifyProcessGroupPermission = (input: {
  readonly leader: ProcessGroupLeaderOwnership;
  readonly members: ProcessGroupMemberOwnership;
  /** True only when this classification follows an EPERM liveness/signal probe. */
  readonly permissionDenied?: boolean;
}): Exclude<ProcessGroupCleanupClassification, "CLEAN"> => {
  // EPERM means that the kernel did not prove the group absent.  An exited
  // direct child is therefore not enough to downgrade the cleanup uncertainty
  // to ESRCH_ALREADY_GONE.
  if (input.permissionDenied === true && input.leader !== "LIVE")
    return "OWNERSHIP_UNPROVEN";
  if (input.leader === "GONE") return "ESRCH_ALREADY_GONE";
  if (input.leader !== "LIVE" || input.members !== "OWNED")
    return "OWNERSHIP_UNPROVEN";
  return "EPERM_OWNED_LIVE";
};

export const leaderOwnershipFor = (input: {
  readonly child: ChildProcess;
  readonly ownership: ProcessGroupOwnership;
}): ProcessGroupLeaderOwnership => {
  if (input.child.pid !== input.ownership.pid || !childIsRunning(input.child))
    return "GONE";
  const uid = process.getuid?.();
  if (
    input.ownership.uid !== undefined &&
    uid !== undefined &&
    input.ownership.uid !== uid
  )
    return "UNPROVEN";
  try {
    process.kill(input.ownership.pid, 0);
    if (
      input.ownership.startToken.length > 0 &&
      processStartTokenFor(input.ownership.pid) !== input.ownership.startToken
    )
      return "UNPROVEN";
    return "LIVE";
  } catch (error: unknown) {
    if (isMissingProcess(error)) return "GONE";
    if (error instanceof Error) return "UNPROVEN";
    throw error;
  }
};

const permissionFailureFor = (input: {
  readonly operationName: string;
  readonly child: ChildProcess;
  readonly ownership: ProcessGroupOwnership;
  readonly detail: string;
}): ProcessGroupCleanupError => {
  const leader = leaderOwnershipFor(input);
  const members = groupOwnershipFor({
    operationName: input.operationName,
    ownership: input.ownership,
  });
  return new ProcessGroupCleanupError(
    input.operationName,
    classifyProcessGroupPermission({
      leader,
      members,
      permissionDenied: true,
    }),
    input.detail,
  );
};

export const processGroupStatusFor = (input: {
  readonly operationName: string;
  readonly child: ChildProcess;
  readonly ownership: ProcessGroupOwnership;
}): ProcessGroupStatus => {
  try {
    process.kill(-input.ownership.pgid, 0);
    return "LIVE";
  } catch (error: unknown) {
    if (isMissingProcess(error)) return "GONE";
    if (isPermissionDenied(error))
      throw permissionFailureFor({
        ...input,
        detail: "process-group liveness probe returned EPERM",
      });
    if (error instanceof Error) throw error;
    throw new ProcessGroupCleanupError(
      input.operationName,
      "OWNERSHIP_UNPROVEN",
      `process-group liveness probe failed: ${String(error)}`,
    );
  }
};

export const signalProcessGroup = (input: {
  readonly operationName: string;
  readonly child: ChildProcess;
  readonly ownership: ProcessGroupOwnership;
  readonly signal: NodeJS.Signals;
}): void => {
  try {
    process.kill(-input.ownership.pgid, input.signal);
  } catch (error: unknown) {
    if (isMissingProcess(error)) return;
    if (isPermissionDenied(error))
      throw permissionFailureFor({
        ...input,
        detail: `signal ${input.signal} returned EPERM`,
      });
    if (error instanceof Error) throw error;
    throw new ProcessGroupCleanupError(
      input.operationName,
      "OWNERSHIP_UNPROVEN",
      `signal ${input.signal} failed: ${String(error)}`,
    );
  }
};

export const ownershipFor = (pid: number): ProcessGroupOwnership => {
  const uid = process.getuid?.();
  return {
    pid,
    pgid: pid,
    ...(uid === undefined ? {} : { uid }),
    startToken: processStartTokenFor(pid) ?? "",
  };
};

/**
 * A detached group is safe to control only after the launch identity has a
 * non-empty start token and a same-user owner.  The child handle remains the
 * only safe cleanup route when this assertion fails at spawn time.
 */
export const assertSpawnOwnership = (input: {
  readonly operationName: string;
  readonly ownership: ProcessGroupOwnership;
}): void => {
  if (
    !Number.isSafeInteger(input.ownership.pid) ||
    input.ownership.pid <= 0 ||
    input.ownership.pgid !== input.ownership.pid
  )
    throw new ProcessGroupCleanupError(
      input.operationName,
      "OWNERSHIP_UNPROVEN",
      "spawned process-group identity is invalid",
    );
  if (input.ownership.startToken.trim() === "")
    throw new ProcessGroupCleanupError(
      input.operationName,
      "OWNERSHIP_UNPROVEN",
      "spawned process has no launch start token",
    );
  const currentUid = process.getuid?.();
  if (
    currentUid === undefined ||
    input.ownership.uid === undefined ||
    input.ownership.uid !== currentUid
  )
    throw new ProcessGroupCleanupError(
      input.operationName,
      "OWNERSHIP_UNPROVEN",
      "spawned process owner could not be proven to be the current user",
    );
};

/** Clean only the direct spawn handle when group ownership is unproven. */
export const terminateUnownedLeader = async (input: {
  readonly operationName: string;
  readonly child: ChildProcess;
  readonly closeGraceMs: number;
}): Promise<readonly unknown[]> => {
  const failures: unknown[] = [];
  const waitForExit = (): Promise<boolean> =>
    new Promise((resolve) => {
      if (!childIsRunning(input.child)) {
        resolve(true);
        return;
      }
      const timer = setTimeout(() => {
        cleanup();
        resolve(!childIsRunning(input.child));
      }, input.closeGraceMs);
      const cleanup = (): void => {
        clearTimeout(timer);
        input.child.off("exit", onExit);
        input.child.off("error", onExit);
      };
      const onExit = (): void => {
        cleanup();
        resolve(true);
      };
      input.child.once("exit", onExit);
      input.child.once("error", onExit);
    });
  try {
    for (const signal of ["SIGTERM", "SIGKILL"] as const) {
      if (!childIsRunning(input.child)) break;
      if (!input.child.kill(signal) && childIsRunning(input.child))
        failures.push(
          new Error(`${input.operationName} unowned leader rejected ${signal}`),
        );
      await waitForExit();
    }
    if (childIsRunning(input.child))
      failures.push(
        new Error(`${input.operationName} unowned leader did not exit`),
      );
  } catch (error: unknown) {
    failures.push(error);
  }
  return failures;
};
