import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import {
  type CoverageCell,
  coverageCellSchema,
  type DOMControl,
  type EvidenceRef,
  evidenceRefSchema,
  type Role,
  type SeedProfile,
} from "./contracts.ts";
import { makeArtifactId } from "./ids.ts";
import type { LiveControlActionRecord } from "./live-control-lane.ts";

const NOT_EXERCISED = "not-exercised" as const;
const UNAVAILABLE = "unavailable" as const;
const BASELINE_MISSING_REASON = "Baseline control has no live action result";

export interface LiveControlEvidenceInput {
  readonly archiveRoot: string;
  readonly sourceSha: string;
  readonly profile: SeedProfile;
  readonly role: Role;
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
  readonly cellPath: string;
  readonly cell: CoverageCell;
  readonly records: readonly LiveControlActionRecord[];
  readonly capturedAt: string;
}

export interface LiveControlEvidenceResult {
  readonly cell: CoverageCell;
  readonly evidence: EvidenceRef;
}

const slug = (value: string): string =>
  value.replaceAll(/[^a-zA-Z0-9]+/g, "-").replaceAll(/^-|-$/g, "") || "root";

const inside = (root: string, candidate: string): string => {
  const rootPath = path.resolve(root);
  const candidatePath = path.resolve(candidate);
  if (
    candidatePath !== rootPath &&
    !candidatePath.startsWith(`${rootPath}${path.sep}`)
  )
    throw new Error(`Live control artifact escaped archive: ${candidatePath}`);
  return candidatePath;
};

const actionResultFor = (
  record: LiveControlActionRecord | undefined,
  evidenceId: string,
): DOMControl["actionResult"] => {
  if (record === undefined)
    return {
      kind: NOT_EXERCISED,
      policy: UNAVAILABLE,
      reason: BASELINE_MISSING_REASON,
    };
  if (record.status === NOT_EXERCISED)
    return {
      kind: NOT_EXERCISED,
      policy: record.policy ?? "inapplicable",
      reason: record.reason ?? "No bounded live action was declared",
    };
  return {
    kind: "exercised",
    result: record.status === "pass" ? "pass" : "fail",
    evidenceIds: [evidenceId],
  };
};

const controlForRecord = (
  input: LiveControlEvidenceInput,
  record: LiveControlActionRecord,
  evidenceId: string,
): DOMControl => ({
  controlKey: record.controlKey,
  cellId: input.cell.cellId,
  ariaRole: record.ariaRole,
  accessibleName: record.accessibleName,
  enabled: record.enabled,
  order: record.order,
  actionResult: actionResultFor(record, evidenceId),
});

const artifactDirectory = (input: LiveControlEvidenceInput): string =>
  inside(
    input.archiveRoot,
    path.join(
      input.archiveRoot,
      "routes",
      input.profile,
      input.role,
      slug(input.catalogRoute),
      "cells",
      input.cell.cellId,
      "action",
    ),
  );

const writeArtifact = async (
  input: LiveControlEvidenceInput,
  directory: string,
): Promise<EvidenceRef> => {
  await mkdir(directory, { recursive: true });
  const archivePath = inside(
    directory,
    path.join(directory, "control-actions.json"),
  );
  const content = Buffer.from(
    `${JSON.stringify(
      {
        sourceSha: input.sourceSha,
        profile: input.profile,
        role: input.role,
        catalogRoute: input.catalogRoute,
        resolvedRoute: input.resolvedRoute,
        cellId: input.cell.cellId,
        capturedAt: input.capturedAt,
        records: input.records,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(archivePath, content);
  const digest = createHash("sha256").update(content).digest("hex");
  const evidence = evidenceRefSchema.parse({
    artifactId: makeArtifactId({
      cellId: input.cell.cellId,
      sourceSha: input.sourceSha,
      archivePath,
      content: digest,
    }),
    kind: "control-action",
    dimension: "runtime",
    archivePath,
    digest,
    capturedAt: input.capturedAt,
    cellId: input.cell.cellId,
    sourceSha: input.sourceSha,
    profile: input.profile,
    role: input.role,
    catalogRoute: input.catalogRoute,
    resolvedRoute: input.resolvedRoute,
  });
  return evidence;
};

const updateCell = async (
  input: LiveControlEvidenceInput,
  evidence: EvidenceRef,
): Promise<CoverageCell> => {
  const byControlKey = new Map<string, LiveControlActionRecord>();
  const duplicateKeys = input.records.filter((record) => {
    if (byControlKey.has(record.controlKey)) return true;
    byControlKey.set(record.controlKey, record);
    return false;
  });
  const baselineControls = input.cell.controls.map((control) => ({
    ...control,
    actionResult: actionResultFor(
      byControlKey.get(control.controlKey),
      evidence.artifactId,
    ),
  }));
  const baselineKeys = new Set(
    input.cell.controls.map(({ controlKey }) => controlKey),
  );
  const dynamicControls = input.records
    .filter(({ controlKey }) => !baselineKeys.has(controlKey))
    .map((record) => controlForRecord(input, record, evidence.artifactId));
  const controls = [...baselineControls, ...dynamicControls];
  const missingBaseline = input.cell.controls.some(
    ({ controlKey }) => !byControlKey.has(controlKey),
  );
  const unnamedControl = input.cell.controls.some(
    ({ accessibleName }) => accessibleName.trim() === "",
  );
  const actionFailure = input.records.some(
    ({ status }) => status === "fail" || status === "ambiguous",
  );
  const enabledUnavailable = input.records.some(
    ({ status, policy, enabled, reason }) =>
      status === NOT_EXERCISED &&
      policy === "unavailable" &&
      enabled &&
      reason !== "Control is disabled",
  );
  const unsafeNotExercised = input.records.some(
    ({ status, policy }) => status === NOT_EXERCISED && policy === "unsafe",
  );
  const hasFailure =
    actionFailure ||
    unsafeNotExercised ||
    enabledUnavailable ||
    missingBaseline ||
    unnamedControl ||
    duplicateKeys.length > 0;
  const cell = coverageCellSchema.parse({
    ...input.cell,
    controls,
    evidence: {
      ...input.cell.evidence,
      action: [...input.cell.evidence.action, evidence],
    },
    verdict: hasFailure
      ? "fail"
      : input.cell.verdict === "pending"
        ? "pass"
        : input.cell.verdict,
  });
  await writeFile(input.cellPath, `${JSON.stringify(cell, null, 2)}\n`, "utf8");
  return cell;
};

export async function writeLiveControlEvidence(
  input: LiveControlEvidenceInput,
): Promise<LiveControlEvidenceResult> {
  const evidence = await writeArtifact(input, artifactDirectory(input));
  const cell = await updateCell(input, evidence);
  return { cell, evidence };
}
