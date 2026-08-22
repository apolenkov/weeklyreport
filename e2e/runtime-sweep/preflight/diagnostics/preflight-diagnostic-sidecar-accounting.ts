import {
  DIAGNOSTIC_MAX_AGGREGATE_BYTES,
  DIAGNOSTIC_MAX_EVENT_RECORDS,
  DIAGNOSTIC_MAX_MANIFEST_BYTES,
  DIAGNOSTIC_MAX_RECORD_BYTES,
  DIAGNOSTIC_MAX_SIDECAR_BYTES,
  diagnosticProcessIdentityFor,
  type DiagnosticProcessRole,
  type DiagnosticSample,
  DiagnosticSidecarContractError,
  type DiagnosticSidecarManifest,
  parseDiagnosticSample,
} from "./preflight-diagnostic-sidecar-contract.ts";
import { digestDiagnosticSidecar } from "./preflight-diagnostic-sidecar-publication.ts";

const recordsFor = (sidecarText: string): readonly DiagnosticSample[] => {
  if (sidecarText === "") return [];
  if (!sidecarText.endsWith("\n"))
    throw new DiagnosticSidecarContractError(
      "Diagnostic sidecar records must end with a newline",
    );
  return sidecarText
    .trimEnd()
    .split("\n")
    .map((line) => {
      if (Buffer.byteLength(`${line}\n`, "utf8") > DIAGNOSTIC_MAX_RECORD_BYTES)
        throw new DiagnosticSidecarContractError(
          "Diagnostic sidecar record exceeds the record byte bound",
        );
      try {
        return parseDiagnosticSample(JSON.parse(line) as unknown);
      } catch (error: unknown) {
        throw new DiagnosticSidecarContractError(
          `Diagnostic sidecar record is invalid: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });
};

const countBy = <T>(values: readonly T[]): Map<T, number> =>
  values.reduce((counts, value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  }, new Map<T, number>());

const assertIdentityStability = (
  records: readonly DiagnosticSample[],
): void => {
  const metadata = new Map<
    string,
    Readonly<{
      readonly parentPid: number | null;
      readonly ownerRootPid: number;
    }>
  >();
  records.forEach((record) => {
    const identity = diagnosticProcessIdentityFor(record);
    const previous = metadata.get(identity);
    if (
      previous !== undefined &&
      (previous.parentPid !== record.parentPid ||
        previous.ownerRootPid !== record.ownerRootPid)
    )
      throw new DiagnosticSidecarContractError(
        `Diagnostic process identity changed: ${identity}`,
      );
    metadata.set(identity, {
      parentPid: record.parentPid,
      ownerRootPid: record.ownerRootPid,
    });
  });
};

const assertRecordCounts = (input: {
  readonly manifest: DiagnosticSidecarManifest;
  readonly records: readonly DiagnosticSample[];
  readonly samples: readonly DiagnosticSample[];
}): void => {
  if (
    input.samples.length !== input.manifest.sampleCount ||
    input.records.length - input.samples.length !== input.manifest.eventCount
  )
    throw new DiagnosticSidecarContractError(
      "Diagnostic manifest record counts do not match samples.jsonl",
    );
};

const assertTrackedIdentities = (
  manifest: DiagnosticSidecarManifest,
  records: readonly DiagnosticSample[],
): void => {
  const trackedIdentities = new Set(
    records.map((record) => diagnosticProcessIdentityFor(record)),
  );
  if (trackedIdentities.size > manifest.maxTrackedProcesses)
    throw new DiagnosticSidecarContractError(
      "Diagnostic manifest tracks too many process identities",
    );
};

const assertRoleCounts = (
  manifest: DiagnosticSidecarManifest,
  sampleCounts: ReadonlyMap<DiagnosticProcessRole, number>,
): void => {
  if (
    Object.values(manifest.processSampleCounts).reduce(
      (total, count) => total + count,
      0,
    ) !== manifest.sampleCount
  )
    throw new DiagnosticSidecarContractError(
      "Diagnostic manifest processSampleCounts does not sum to sampleCount",
    );
  for (const [role, count] of sampleCounts) {
    if (manifest.processSampleCounts[role] !== count)
      throw new DiagnosticSidecarContractError(
        `Diagnostic manifest processSampleCounts does not match ${role}`,
      );
  }
};

const assertIdentityCounts = (
  manifest: DiagnosticSidecarManifest,
  identityCounts: ReadonlyMap<string, number>,
): void => {
  for (const [identity, count] of identityCounts) {
    if (count > manifest.maxSamplesPerProcess)
      throw new DiagnosticSidecarContractError(
        `Diagnostic manifest sample count exceeds the bound for ${identity}`,
      );
    if (manifest.processIdentitySampleCounts[identity] !== count)
      throw new DiagnosticSidecarContractError(
        `Diagnostic manifest processIdentitySampleCounts does not match ${identity}`,
      );
  }
};

const assertCountMapKeys = (
  manifest: DiagnosticSidecarManifest,
  sampleCounts: ReadonlyMap<DiagnosticProcessRole, number>,
  identityCounts: ReadonlyMap<string, number>,
): void => {
  if (
    Object.entries(manifest.processIdentitySampleCounts).some(
      ([identity]) => !identityCounts.has(identity),
    ) ||
    Object.entries(manifest.processSampleCounts).some(
      ([role]) => !sampleCounts.has(role as DiagnosticProcessRole),
    )
  )
    throw new DiagnosticSidecarContractError(
      "Diagnostic manifest count maps contain an unmatched key",
    );
};

const assertCountMaps = (input: {
  readonly manifest: DiagnosticSidecarManifest;
  readonly records: readonly DiagnosticSample[];
}): void => {
  const samples = input.records.filter(
    (record) => record.recordKind === "sample",
  );
  const sampleCounts = countBy(samples.map((record) => record.processRole));
  const identityCounts = countBy(
    samples.map((record) => diagnosticProcessIdentityFor(record)),
  );
  assertRecordCounts({ ...input, samples });
  assertTrackedIdentities(input.manifest, input.records);
  assertRoleCounts(input.manifest, sampleCounts);
  assertIdentityCounts(input.manifest, identityCounts);
  assertCountMapKeys(input.manifest, sampleCounts, identityCounts);
  assertCaptureStatus(input.manifest, samples);
};

function assertCaptureStatus(
  manifest: DiagnosticSidecarManifest,
  samples: readonly DiagnosticSample[],
): void {
  if (samples.some((sample) => sample.processRole === "renderer"))
    throw new DiagnosticSidecarContractError(
      "Renderer capture requires a page-bound process proof",
    );
  const captured = new Set(samples.map((sample) => sample.processRole));
  const expectedStatus = {
    "playwright-child": captured.has("playwright-child")
      ? "CAPTURED"
      : "NOT_CAPTURED",
    browser: captured.has("browser") ? "CAPTURED" : "NOT_CAPTURED",
    renderer: "NOT_CAPTURED",
  } as const;
  if (
    manifest.processCaptureStatus["playwright-child"] !==
      expectedStatus["playwright-child"] ||
    manifest.processCaptureStatus.browser !== expectedStatus.browser ||
    manifest.processCaptureStatus.renderer !== expectedStatus.renderer
  )
    throw new DiagnosticSidecarContractError(
      "Diagnostic manifest processCaptureStatus does not match samples",
    );
}

export function assertDiagnosticSidecarManifestAccounting(input: {
  readonly manifest: DiagnosticSidecarManifest;
  readonly sidecarText: string;
}): void {
  const { manifest, sidecarText } = input;
  const sidecarBytes = Buffer.byteLength(sidecarText, "utf8");
  if (sidecarBytes !== manifest.sidecarBytes)
    throw new DiagnosticSidecarContractError(
      "Diagnostic manifest sidecarBytes does not match samples.jsonl",
    );
  if (sidecarBytes > DIAGNOSTIC_MAX_SIDECAR_BYTES)
    throw new DiagnosticSidecarContractError(
      "Diagnostic manifest sidecarBytes exceeds the sidecar bound",
    );
  if (manifest.manifestBytes > DIAGNOSTIC_MAX_MANIFEST_BYTES)
    throw new DiagnosticSidecarContractError(
      "Diagnostic manifest manifestBytes exceeds the manifest bound",
    );
  if (
    manifest.aggregateBytes !==
    manifest.sidecarBytes + manifest.manifestBytes
  )
    throw new DiagnosticSidecarContractError(
      "Diagnostic manifest aggregateBytes is not canonical",
    );
  if (manifest.aggregateBytes > DIAGNOSTIC_MAX_AGGREGATE_BYTES)
    throw new DiagnosticSidecarContractError(
      "Diagnostic manifest aggregateBytes exceeds the aggregate bound",
    );
  if (manifest.eventCount > DIAGNOSTIC_MAX_EVENT_RECORDS)
    throw new DiagnosticSidecarContractError(
      "Diagnostic manifest eventCount exceeds the event bound",
    );
  if (
    digestDiagnosticSidecar(Buffer.from(sidecarText, "utf8")) !==
    manifest.sidecarDigest
  )
    throw new DiagnosticSidecarContractError(
      "Diagnostic manifest sidecarDigest does not match samples.jsonl",
    );
  const records = recordsFor(sidecarText);
  assertIdentityStability(records);
  assertCountMaps({ manifest, records });
}
