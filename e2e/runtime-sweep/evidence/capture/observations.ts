import { z } from "zod";

import type { KeyboardTrace } from "../../replay/keyboard-evidence.ts";
import {
  evidenceObservationSchema,
  type EvidenceRef,
} from "../../source/contracts.ts";
import type { EvidenceCaptureInput } from "../evidence-types.ts";

type Observation = z.infer<typeof evidenceObservationSchema>;
type CountObservation = readonly [
  string,
  Observation["kind"],
  number,
  string,
  EvidenceRef["kind"],
];

const PAGE_ERROR_KIND = "page-error" as const;
const OK_STATUS_LIMIT = 400;
const byKind = (
  refs: readonly EvidenceRef[],
  kind: EvidenceRef["kind"],
): EvidenceRef => {
  const value = refs.find((candidate) => candidate.kind === kind);
  if (!value) throw new Error(`Runtime sweep evidence ref ${kind} is missing`);
  return value;
};

const countObservation = (
  spec: CountObservation,
  refs: readonly EvidenceRef[],
): Observation => {
  const [id, kind, count, label, refKind] = spec;
  return evidenceObservationSchema.parse({
    observationId: id,
    kind,
    outcome: count > 0 ? "fail" : "pass",
    message: `${count} ${label} observed`,
    evidenceIds: [byKind(refs, refKind).artifactId],
  });
};

const keyboardObservation = (
  input: EvidenceCaptureInput,
  refs: readonly EvidenceRef[],
  keyboard: KeyboardTrace,
): Observation => {
  const keyboardPass =
    keyboard.focusMoved &&
    keyboard.focusGaps.length === 0 &&
    input.inventory.issues.length === 0;
  return evidenceObservationSchema.parse({
    observationId: "keyboard",
    kind: "keyboard",
    outcome: keyboardPass ? "pass" : "fail",
    message: keyboardPass
      ? `Keyboard focus reached all ${keyboard.controls.length} controls with usable role/name evidence`
      : `${keyboard.focusGaps.length} enabled control(s) missed keyboard focus; ${input.inventory.issues.length} accessible-name issue(s) observed`,
    evidenceIds: [
      byKind(refs, "keyboard").artifactId,
      byKind(refs, "dom").artifactId,
    ],
  });
};

const functionalObservation = (
  refs: readonly EvidenceRef[],
  functional: Readonly<{ matches: boolean; message: string }>,
): Observation =>
  evidenceObservationSchema.parse({
    observationId: "functional",
    kind: "api",
    outcome: functional.matches ? "pass" : "fail",
    message: functional.message,
    evidenceIds: [byKind(refs, "api").artifactId],
  });

const navigationObservation = (
  input: EvidenceCaptureInput,
  refs: readonly EvidenceRef[],
): Observation =>
  evidenceObservationSchema.parse({
    observationId: "navigation",
    kind: "api",
    outcome:
      input.responseStatus !== null && input.responseStatus < OK_STATUS_LIMIT
        ? "pass"
        : "fail",
    message: `Navigation returned HTTP ${input.responseStatus ?? "no response"}`,
    evidenceIds: [byKind(refs, "url").artifactId],
  });

const visualObservation = (
  refs: readonly EvidenceRef[],
  screenshot: EvidenceRef,
  visualOracle: EvidenceRef,
  visual: Readonly<{ outcome: "pass" | "fail"; message: string }>,
): Observation =>
  evidenceObservationSchema.parse({
    observationId: "visual",
    kind: "geometry",
    outcome: visual.outcome,
    message: visual.message,
    evidenceIds: [
      byKind(refs, "geometry").artifactId,
      screenshot.artifactId,
      visualOracle.artifactId,
    ],
  });

export const observations = (
  input: EvidenceCaptureInput,
  refs: readonly EvidenceRef[],
  screenshot: EvidenceRef,
  visualOracle: EvidenceRef,
  visual: Readonly<{ outcome: "pass" | "fail"; message: string }>,
  violations: readonly unknown[],
  keyboard: KeyboardTrace,
  functional: Readonly<{ matches: boolean; message: string }> | null,
): readonly Observation[] => {
  const counts: readonly CountObservation[] = [
    [
      "console",
      "console",
      input.consoleMessages.length,
      "console message(s)",
      "console",
    ],
    [
      "page-error",
      PAGE_ERROR_KIND,
      input.pageErrors.length,
      "page error(s)",
      PAGE_ERROR_KIND,
    ],
    [
      "network",
      "network",
      input.requestFailures.length,
      "failed request(s)",
      "request",
    ],
    ["axe", "axe", violations.length, "axe violation(s)", "axe"],
  ];
  return Object.freeze([
    ...counts.map((spec) => countObservation(spec, refs)),
    keyboardObservation(input, refs, keyboard),
    ...(functional === null ? [] : [functionalObservation(refs, functional)]),
    navigationObservation(input, refs),
    visualObservation(refs, screenshot, visualOracle, visual),
  ]);
};
