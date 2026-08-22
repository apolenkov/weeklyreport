import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { DiagnosticProcessRole } from "./preflight-diagnostic-sidecar-contract.ts";

const execFileAsync = promisify(execFile);
const PS_TIMEOUT_MS = 250;
const KIBIBYTES = 1024;
const MILLISECONDS_PER_SECOND = 1000;
const PS_COLUMN_COUNT = 6;
const PS_COMMAND_COLUMN_INDEX = 5;
const CHROMIUM_PROCESS_NAMES = ["chrome", "chromium", "headless-shell"];
const NON_TARGET_CHROMIUM_MARKERS = [
  "crashpad",
  "--type=gpu-process",
  "--type=renderer",
  "--type=utility",
  "--type=zygote",
];

class DiagnosticProcessSamplingError extends Error {
  override readonly name = "DiagnosticProcessSamplingError";
}

export type DiagnosticProcessSnapshot = Readonly<{
  readonly pid: number;
  readonly processRole: DiagnosticProcessRole;
  readonly processStartWall: number;
  readonly parentPid: number | null;
  readonly ownerRootPid: number;
  readonly processRssBytes: number | null;
  readonly processVsizeBytes: number | null;
  readonly cpuPercent: number | null;
}>;

type PsProcess = Readonly<{
  readonly pid: number;
  readonly parentPid: number;
  readonly rssBytes: number | null;
  readonly vsizeBytes: number | null;
  readonly cpuPercent: number | null;
  readonly command: string;
}>;

const currentProcessStartWall = Math.max(
  0,
  Math.floor(Date.now() - process.uptime() * MILLISECONDS_PER_SECOND),
);

const currentProcessSnapshot = (): DiagnosticProcessSnapshot => {
  const memory = process.memoryUsage();
  return {
    pid: process.pid,
    processRole: "playwright-child",
    processStartWall: currentProcessStartWall,
    parentPid: process.ppid > 0 ? process.ppid : null,
    ownerRootPid: process.pid,
    processRssBytes: memory.rss,
    processVsizeBytes: null,
    cpuPercent: null,
  };
};

const parsePsLine = (line: string): PsProcess | undefined => {
  const columns = line.trim().split(/\s+/u);
  if (columns.length < PS_COLUMN_COUNT) return undefined;
  const [pidText, parentText, rssText, vsizeText, cpuText] = columns;
  const command = columns.slice(PS_COMMAND_COLUMN_INDEX).join(" ");
  if (
    pidText === undefined ||
    parentText === undefined ||
    rssText === undefined ||
    vsizeText === undefined ||
    cpuText === undefined
  )
    return undefined;
  const pid = Number(pidText);
  const parentPid = Number(parentText);
  const rssKiB = Number(rssText);
  const vsizeKiB = Number(vsizeText);
  const cpuPercent = Number(cpuText);
  if (!Number.isSafeInteger(pid) || !Number.isSafeInteger(parentPid))
    return undefined;
  if (
    !Number.isFinite(rssKiB) ||
    !Number.isFinite(vsizeKiB) ||
    !Number.isFinite(cpuPercent)
  )
    return undefined;
  return {
    pid,
    parentPid,
    rssBytes: rssKiB * KIBIBYTES,
    vsizeBytes: vsizeKiB * KIBIBYTES,
    cpuPercent,
    command: command.trim(),
  };
};

const readPsProcesses = async (): Promise<readonly PsProcess[]> => {
  try {
    const result = await execFileAsync(
      "ps",
      ["-axo", "pid=,ppid=,rss=,vsz=,%cpu=,args="],
      { timeout: PS_TIMEOUT_MS, maxBuffer: 100_000 },
    );
    return result.stdout
      .split("\n")
      .map(parsePsLine)
      .filter(
        (processValue): processValue is PsProcess => processValue !== undefined,
      );
  } catch (error: unknown) {
    throw new DiagnosticProcessSamplingError(
      `Cannot read diagnostic process table: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const startWallFor = async (pid: number): Promise<number | undefined> => {
  try {
    const result = await execFileAsync(
      "ps",
      ["-p", String(pid), "-o", "lstart="],
      { timeout: PS_TIMEOUT_MS, maxBuffer: 2000 },
    );
    const timestamp = Date.parse(result.stdout.trim());
    return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : undefined;
  } catch (error: unknown) {
    throw new DiagnosticProcessSamplingError(
      `Cannot read diagnostic process start time: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const descendantDepthFor = (
  processes: ReadonlyMap<number, PsProcess>,
  pid: number,
  rootPid: number,
  seen: ReadonlySet<number> = new Set(),
): number | undefined => {
  if (pid === rootPid) return 0;
  if (seen.has(pid)) return undefined;
  const processValue = processes.get(pid);
  if (processValue === undefined) return undefined;
  const parentDepth = descendantDepthFor(
    processes,
    processValue.parentPid,
    rootPid,
    new Set([...seen, pid]),
  );
  return parentDepth === undefined ? undefined : 1 + parentDepth;
};

const childSnapshotFor = async (
  processValue: PsProcess,
  role: "browser" | "renderer",
): Promise<DiagnosticProcessSnapshot | undefined> => {
  const processStartWall = await startWallFor(processValue.pid).catch(
    (error: unknown) => {
      if (error instanceof DiagnosticProcessSamplingError) return undefined;
      throw error;
    },
  );
  if (processStartWall === undefined) return undefined;
  return {
    pid: processValue.pid,
    processRole: role,
    processStartWall,
    parentPid: processValue.parentPid > 0 ? processValue.parentPid : null,
    ownerRootPid: process.pid,
    processRssBytes: processValue.rssBytes,
    processVsizeBytes: processValue.vsizeBytes,
    cpuPercent: processValue.cpuPercent,
  };
};

export const diagnosticProcessRoleFor = (
  command: string,
  depth: number,
): "browser" | undefined => {
  if (NON_TARGET_CHROMIUM_MARKERS.some((marker) => command.includes(marker)))
    return undefined;
  return depth === 1 ? "browser" : undefined;
};

export async function readOwnedDiagnosticProcesses(): Promise<
  readonly DiagnosticProcessSnapshot[]
> {
  const current = currentProcessSnapshot();
  const processes = await readPsProcesses().catch((error: unknown) => {
    if (error instanceof DiagnosticProcessSamplingError) return [];
    throw error;
  });
  const byPid = new Map(
    processes.map((processValue) => [processValue.pid, processValue]),
  );
  const children = processes
    .filter(
      (processValue) =>
        processValue.pid !== current.pid &&
        CHROMIUM_PROCESS_NAMES.some((name) =>
          processValue.command.includes(name),
        ),
    )
    .map((processValue) => {
      const depth = descendantDepthFor(byPid, processValue.pid, current.pid);
      return {
        processValue,
        depth,
        role:
          depth === undefined
            ? undefined
            : diagnosticProcessRoleFor(processValue.command, depth),
      };
    })
    .filter(
      (
        candidate,
      ): candidate is {
        readonly processValue: PsProcess;
        readonly depth: number;
        readonly role: "browser";
      } =>
        candidate.depth !== undefined &&
        candidate.depth > 0 &&
        candidate.role !== undefined,
    )
    .toSorted(
      (left, right) =>
        left.depth - right.depth ||
        left.processValue.pid - right.processValue.pid,
    )
    .slice(0, 2);
  const snapshots = await Promise.all(
    children.map(({ processValue, role }) =>
      childSnapshotFor(processValue, role),
    ),
  );
  return [
    current,
    ...snapshots.filter(
      (snapshot): snapshot is DiagnosticProcessSnapshot =>
        snapshot !== undefined,
    ),
  ];
}
