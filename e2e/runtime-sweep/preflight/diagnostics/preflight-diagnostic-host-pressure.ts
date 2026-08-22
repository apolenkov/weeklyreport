import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const HOST_PRESSURE_TIMEOUT_MS = 750;
const HOST_PRESSURE_MAX_BUFFER = 16_384;
const BYTES_PER_KIBIBYTE = 1024;
const KIBIBYTES_PER_MEBIBYTE = 1024;
const MEBIBYTES_PER_GIBIBYTE = 1024;
const GIBIBYTES_PER_TEBIBYTE = 1024;
const KIBIBYTES = BYTES_PER_KIBIBYTE;
const MEBIBYTES = KIBIBYTES * KIBIBYTES_PER_MEBIBYTE;
const GIBIBYTES = MEBIBYTES * MEBIBYTES_PER_GIBIBYTE;
const TEBIBYTES = GIBIBYTES * GIBIBYTES_PER_TEBIBYTE;

type DarwinHostCommand = "vm_stat" | "sysctl";

type DarwinVmStat = Readonly<{
  readonly compressedBytes: number | null;
  readonly pageins: number | null;
  readonly pageouts: number | null;
  readonly swapins: number | null;
  readonly swapouts: number | null;
}>;

type DarwinSwapUsage = Readonly<{
  readonly swapTotalBytes: number | null;
  readonly swapUsedBytes: number | null;
  readonly swapFreeBytes: number | null;
}>;

export type DiagnosticHostPressure = Readonly<{
  readonly compressedBytes: number | null;
  readonly swapTotalBytes: number | null;
  readonly swapUsedBytes: number | null;
  readonly swapFreeBytes: number | null;
  readonly swapinsDelta: number | null;
  readonly swapoutsDelta: number | null;
  readonly pageinsDelta: number | null;
  readonly pageoutsDelta: number | null;
}>;

export type DiagnosticHostPressureCommandRunner = (
  command: DarwinHostCommand,
) => Promise<string>;

const safeIntegerFor = (raw: string | undefined): number | null => {
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
};

const safeByteProductFor = (
  value: number | null,
  multiplier: number,
): number | null => {
  if (value === null) return null;
  const rawBytes = value * multiplier;
  if (!Number.isFinite(rawBytes) || rawBytes < 0) return null;
  const bytes = Math.round(rawBytes);
  return Number.isSafeInteger(bytes) ? bytes : null;
};

const counterFor = (output: string, label: string): number | null =>
  safeIntegerFor(
    new RegExp(String.raw`${label}\s*:\s*(\d+)\.`, "iu").exec(output)?.[1],
  );

const multiplierFor = (unit: string): number | null => {
  switch (unit.toUpperCase()) {
    case "":
      return 1;
    case "K":
      return KIBIBYTES;
    case "M":
      return MEBIBYTES;
    case "G":
      return GIBIBYTES;
    case "T":
      return TEBIBYTES;
    default:
      return null;
  }
};

const swapBytesFor = (output: string, label: string): number | null => {
  const match = new RegExp(
    String.raw`${label}\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*([KMGT]?)B?`,
    "iu",
  ).exec(output);
  const rawValue = match?.[1];
  const unit = match?.[2] ?? "";
  const multiplier = multiplierFor(unit);
  if (rawValue === undefined || multiplier === null) return null;
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0) return null;
  return safeByteProductFor(value, multiplier);
};

export const parseDarwinVmStat = (output: string): DarwinVmStat => {
  const pageSize = safeIntegerFor(
    /page size of\s+(\d+)\s+bytes/iu.exec(output)?.[1],
  );
  const compressedPages = counterFor(output, "Pages occupied by compressor");
  return {
    compressedBytes:
      pageSize === null ? null : safeByteProductFor(compressedPages, pageSize),
    pageins: counterFor(output, "Pageins"),
    pageouts: counterFor(output, "Pageouts"),
    swapins: counterFor(output, "Swapins"),
    swapouts: counterFor(output, "Swapouts"),
  };
};

export const parseDarwinSwapUsage = (output: string): DarwinSwapUsage => ({
  swapTotalBytes: swapBytesFor(output, "total"),
  swapUsedBytes: swapBytesFor(output, "used"),
  swapFreeBytes: swapBytesFor(output, "free"),
});

const defaultCommandRunner: DiagnosticHostPressureCommandRunner = async (
  command,
): Promise<string> => {
  const args = command === "vm_stat" ? [] : ["vm.swapusage"];
  const result = await execFileAsync(command, args, {
    timeout: HOST_PRESSURE_TIMEOUT_MS,
    maxBuffer: HOST_PRESSURE_MAX_BUFFER,
  });
  return result.stdout;
};

const outputFor = (
  result: PromiseSettledResult<string> | undefined,
): string | undefined =>
  result?.status === "fulfilled" ? result.value : undefined;

const deltaFor = (
  current: number | null,
  previous: number | undefined,
): number | null =>
  current === null || previous === undefined || current < previous
    ? null
    : current - previous;

export const createDiagnosticHostPressureSampler = (
  commandRunner: DiagnosticHostPressureCommandRunner = defaultCommandRunner,
): Readonly<{
  readonly read: () => Promise<DiagnosticHostPressure>;
}> => {
  const previousCounters = new Map<
    "pageins" | "pageouts" | "swapins" | "swapouts",
    number
  >();

  const read = async (): Promise<DiagnosticHostPressure> => {
    const results = await Promise.allSettled([
      commandRunner("vm_stat"),
      commandRunner("sysctl"),
    ]);
    const vmStat = parseDarwinVmStat(outputFor(results[0]) ?? "");
    const swapUsage = parseDarwinSwapUsage(outputFor(results[1]) ?? "");
    const deltas = {
      pageinsDelta: deltaFor(vmStat.pageins, previousCounters.get("pageins")),
      pageoutsDelta: deltaFor(
        vmStat.pageouts,
        previousCounters.get("pageouts"),
      ),
      swapinsDelta: deltaFor(vmStat.swapins, previousCounters.get("swapins")),
      swapoutsDelta: deltaFor(
        vmStat.swapouts,
        previousCounters.get("swapouts"),
      ),
    };
    if (vmStat.pageins !== null)
      previousCounters.set("pageins", vmStat.pageins);
    if (vmStat.pageouts !== null)
      previousCounters.set("pageouts", vmStat.pageouts);
    if (vmStat.swapins !== null)
      previousCounters.set("swapins", vmStat.swapins);
    if (vmStat.swapouts !== null)
      previousCounters.set("swapouts", vmStat.swapouts);
    return {
      compressedBytes: vmStat.compressedBytes,
      ...swapUsage,
      ...deltas,
    };
  };

  return { read };
};
