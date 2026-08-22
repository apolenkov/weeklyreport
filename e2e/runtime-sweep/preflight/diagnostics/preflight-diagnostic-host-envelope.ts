import { execFile } from "node:child_process";
import os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";

import {
  parseDarwinSwapUsage,
  parseDarwinVmStat,
} from "./preflight-diagnostic-host-pressure.ts";

const execFileAsync = promisify(execFile);
const HOST_PRESSURE_TIMEOUT_MS = 750;
const HOST_PRESSURE_MAX_BUFFER = 16_384;
const FOUR_GIBIBYTES = 4_294_967_296;
const EIGHT_GIBIBYTES = 8_589_934_592;
const TWELVE_GIBIBYTES = 12_884_901_888;
const TWO_GIBIBYTES = 2_147_483_648;
const ONE_GIBIBYTE = 1_073_741_824;
const FIVE_HUNDRED_TWELVE_MEBIBYTES = 536_870_912;
const BASELINE_FREE_PERCENT = 25;
const ABORT_FREE_PERCENT = 15;
const MAX_PRESSURE_FREE_PERCENT = 100;
const PRE_RESOURCE_BASELINE_SAMPLES = 120;
const POST_INFRASTRUCTURE_BASELINE_SAMPLES = 60;
const SAMPLE_INTERVAL_MS = 1000;
const HYSTERESIS_SAMPLES = 3;
const MAX_RECORDS = 1800;
const MAX_RECORD_BYTES = 512;
const MAX_MANIFEST_BYTES = 102_400;
const MAX_AGGREGATE_BYTES = 1_048_576;

export const HOST_ENVELOPE_MODE_ENV = "RUNTIME_SWEEP_DIAGNOSTIC_HOST_ENVELOPE";
export const HOST_ENVELOPE_OUTPUT_ROOT_ENV =
  "RUNTIME_SWEEP_DIAGNOSTIC_PRESSURE_OUTPUT_ROOT";

export const HOST_ENVELOPE_THRESHOLDS = {
  baselineRawFreeBytes: FOUR_GIBIBYTES,
  baselineAvailableBytes: EIGHT_GIBIBYTES,
  baselineFreePercent: BASELINE_FREE_PERCENT,
  baselineSwapUsedBytes: FIVE_HUNDRED_TWELVE_MEBIBYTES,
  baselineCompressedBytes: EIGHT_GIBIBYTES,
  abortRawFreeBytes: TWO_GIBIBYTES,
  abortAvailableBytes: FOUR_GIBIBYTES,
  abortFreePercent: ABORT_FREE_PERCENT,
  abortSwapUsedBytes: ONE_GIBIBYTE,
  abortSwapGrowthBytes: FIVE_HUNDRED_TWELVE_MEBIBYTES,
  abortCompressedBytes: TWELVE_GIBIBYTES,
  preResourceBaselineSamples: PRE_RESOURCE_BASELINE_SAMPLES,
  postInfrastructureBaselineSamples: POST_INFRASTRUCTURE_BASELINE_SAMPLES,
  sampleIntervalMs: SAMPLE_INTERVAL_MS,
  hysteresisSamples: HYSTERESIS_SAMPLES,
  maxRecords: MAX_RECORDS,
  maxRecordBytes: MAX_RECORD_BYTES,
  maxManifestBytes: MAX_MANIFEST_BYTES,
  maxAggregateBytes: MAX_AGGREGATE_BYTES,
} as const;

export type HostEnvelopeMode = "off" | "enforce";
export type HostEnvelopePhase =
  "pre-resource" | "post-infrastructure" | "runtime" | "cleanup";
export type HostPressureState = "normal" | "warning" | "critical";
export type HostEnvelopeCommand = "vm_stat" | "sysctl" | "memory_pressure";

export type DiagnosticHostEnvelopeSnapshot = Readonly<{
  readonly timestampWall: number;
  readonly phase: HostEnvelopePhase;
  readonly rawFreeBytes: number | null;
  readonly availableBytes: number | null;
  readonly totalBytes: number | null;
  readonly compressedBytes: number | null;
  readonly swapUsedBytes: number | null;
  readonly swapFreeBytes: number | null;
  readonly pressureFreePercent: number | null;
  readonly pressureState: HostPressureState | null;
  readonly pageins: number | null;
  readonly pageouts: number | null;
  readonly swapins: number | null;
  readonly swapouts: number | null;
}>;

export type DiagnosticHostEnvelopeCounters = Readonly<{
  readonly pageins: number;
  readonly pageouts: number;
  readonly swapins: number;
  readonly swapouts: number;
}>;

export type HostEnvelopeBreachStreaks = Readonly<{
  readonly rawFreeBytes: number;
  readonly availableBytes: number;
  readonly pressureFreePercent: number;
  readonly compressedBytes: number;
}>;

export const EMPTY_HOST_ENVELOPE_BREACH_STREAKS: HostEnvelopeBreachStreaks = {
  rawFreeBytes: 0,
  availableBytes: 0,
  pressureFreePercent: 0,
  compressedBytes: 0,
};

export type HostEnvelopeEvaluation = Readonly<{
  readonly status: "healthy" | "breach" | "invalid";
  readonly reasons: readonly string[];
  readonly breachStreaks: HostEnvelopeBreachStreaks;
  readonly nextCounters: DiagnosticHostEnvelopeCounters | undefined;
}>;

export type DiagnosticHostEnvelopeCommandRunner = (
  command: HostEnvelopeCommand,
) => Promise<string>;

const finiteNonNegative = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value >= 0;

const finitePercent = (value: number | null): value is number =>
  finiteNonNegative(value) && value <= MAX_PRESSURE_FREE_PERCENT;

const bytesForPages = (
  pageSizeBytes: number | null,
  pages: number | null,
): number | null => {
  if (!finiteNonNegative(pageSizeBytes) || !finiteNonNegative(pages))
    return null;
  const bytes = pageSizeBytes * pages;
  return Number.isSafeInteger(bytes) ? bytes : null;
};

const outputFor = (result: PromiseSettledResult<string> | undefined): string =>
  result?.status === "fulfilled" ? result.value : "";

const defaultCommandRunner: DiagnosticHostEnvelopeCommandRunner = async (
  command,
): Promise<string> => {
  const args =
    command === "vm_stat"
      ? []
      : command === "sysctl"
        ? ["vm.swapusage"]
        : ["-Q"];
  const result = await execFileAsync(command, args, {
    timeout: HOST_PRESSURE_TIMEOUT_MS,
    maxBuffer: HOST_PRESSURE_MAX_BUFFER,
  });
  return result.stdout;
};

export const parseDarwinMemoryPressure = (
  output: string,
): Readonly<{
  readonly freePercent: number | null;
  readonly state: HostPressureState | null;
}> => {
  const rawPercent = /free percentage:\s*(\d+)%/iu.exec(output)?.[1];
  const percent = rawPercent === undefined ? null : Number(rawPercent);
  if (!finitePercent(percent)) return { freePercent: null, state: null };
  const stateMatch = /\b(warning|critical)\b/iu.exec(output)?.[1];
  return {
    freePercent: percent,
    state:
      stateMatch === undefined
        ? "normal"
        : stateMatch.toLowerCase() === "critical"
          ? "critical"
          : "warning",
  };
};

export const readDarwinHostEnvelopeSnapshot = async (
  phase: HostEnvelopePhase,
  commandRunner: DiagnosticHostEnvelopeCommandRunner = defaultCommandRunner,
): Promise<DiagnosticHostEnvelopeSnapshot> => {
  const results = await Promise.allSettled([
    commandRunner("vm_stat"),
    commandRunner("sysctl"),
    commandRunner("memory_pressure"),
  ]);
  const vmStat = parseDarwinVmStat(outputFor(results[0]));
  const swapUsage = parseDarwinSwapUsage(outputFor(results[1]));
  const memoryPressure = parseDarwinMemoryPressure(outputFor(results[2]));
  return {
    timestampWall: Date.now(),
    phase,
    rawFreeBytes: bytesForPages(vmStat.pageSizeBytes, vmStat.freePages),
    availableBytes: bytesForPages(
      vmStat.pageSizeBytes,
      vmStat.freePages === null ||
        vmStat.inactivePages === null ||
        vmStat.speculativePages === null
        ? null
        : vmStat.freePages + vmStat.inactivePages + vmStat.speculativePages,
    ),
    totalBytes: os.totalmem(),
    compressedBytes: vmStat.compressedBytes,
    swapUsedBytes: swapUsage.swapUsedBytes,
    swapFreeBytes: swapUsage.swapFreeBytes,
    pressureFreePercent: memoryPressure.freePercent,
    pressureState: memoryPressure.state,
    pageins: vmStat.pageins,
    pageouts: vmStat.pageouts,
    swapins: vmStat.swapins,
    swapouts: vmStat.swapouts,
  };
};

export const hostEnvelopeModeFromEnvironment = (
  environment: NodeJS.ProcessEnv,
): HostEnvelopeMode => {
  const value = environment[HOST_ENVELOPE_MODE_ENV];
  if (value === undefined || value === "off") return "off";
  if (value === "enforce") return "enforce";
  throw new Error(`${HOST_ENVELOPE_MODE_ENV} must be off or enforce`);
};

export const hostEnvelopeOutputRootFromEnvironment = (
  environment: NodeJS.ProcessEnv,
): string => {
  const value = environment[HOST_ENVELOPE_OUTPUT_ROOT_ENV]?.trim();
  if (!value) throw new Error(`${HOST_ENVELOPE_OUTPUT_ROOT_ENV} is required`);
  const normalized = path.resolve(value);
  if (normalized !== value || !path.isAbsolute(value))
    throw new Error(
      `${HOST_ENVELOPE_OUTPUT_ROOT_ENV} must be a normalized absolute path`,
    );
  return normalized;
};
