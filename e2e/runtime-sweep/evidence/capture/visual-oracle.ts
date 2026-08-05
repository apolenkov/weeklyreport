import { readFile } from "node:fs/promises";
import * as path from "node:path";

import {
  type EvidenceRef,
  sha256DigestSchema,
  sourceShaSchema,
} from "../../source/contracts.ts";
import { stableSerialize } from "../../support/ids.ts";
import type {
  EvidenceCaptureInput,
  FunctionalAssertion,
  GeometryOracle,
  GeometrySnapshot,
} from "../evidence-types.ts";
import { type ArtifactSpec, digest } from "./artifacts.ts";

export type BaselineCapture = Readonly<{
  archivePath: string;
  digest: string;
  sourceSha: string;
}>;
export type VisualEvaluation = Readonly<{
  outcome: "pass" | "fail";
  message: string;
  issues: readonly string[];
  baseline: BaselineCapture | null;
  reviewedMasks: readonly string[];
}>;
export type FunctionalPayload = Readonly<{
  assertionId: string;
  expected: unknown;
  actual: unknown;
  matches: boolean;
  message: string;
}>;

export const functionalPayload = (
  assertion: FunctionalAssertion,
): FunctionalPayload => {
  const matches =
    stableSerialize(assertion.expected) === stableSerialize(assertion.actual);
  return { ...assertion, matches };
};

export const readVisualBaseline = async (
  input: EvidenceCaptureInput,
  directory: string,
): Promise<BaselineCapture | null> => {
  const baseline = input.visualBaseline;
  if (!baseline) return null;
  sourceShaSchema.parse(baseline.sourceSha);
  if (baseline.sourceSha !== input.sourceSha) {
    throw new Error(
      `Runtime sweep visual baseline source SHA ${baseline.sourceSha} does not match capture ${input.sourceSha}`,
    );
  }
  sha256DigestSchema.parse(baseline.digest);
  if (baseline.reviewedMasks.length > 0) {
    throw new Error(
      "Runtime sweep visual baselines require an explicit empty reviewedMasks list",
    );
  }
  const archivePath = path.resolve(baseline.archivePath);
  const screenshotPath = path.resolve(path.join(directory, "screenshot.png"));
  if (archivePath === screenshotPath) {
    throw new Error(
      "Runtime sweep visual baseline cannot be overwritten by its final capture",
    );
  }
  const content = await readFile(archivePath);
  const actualDigest = digest(content);
  if (actualDigest !== baseline.digest) {
    throw new Error(
      `Runtime sweep visual baseline digest changed: expected ${baseline.digest}, got ${actualDigest}`,
    );
  }
  return {
    archivePath,
    digest: baseline.digest,
    sourceSha: baseline.sourceSha,
  };
};

const geometryIssues = (
  snapshot: GeometrySnapshot,
  oracle: GeometryOracle | undefined,
): readonly string[] => {
  const horizontalOverflow =
    snapshot.document.scrollWidth - snapshot.viewport.width;
  const verticalOverflow =
    snapshot.document.scrollHeight - snapshot.viewport.height;
  const expectedViewport = oracle?.viewport;
  const structuralIssues =
    oracle?.requireNoZeroSize === false
      ? snapshot.issues.filter((issue) => !issue.includes("zero-size"))
      : snapshot.issues;
  return [
    ...structuralIssues,
    ...(expectedViewport &&
    (snapshot.viewport.width !== expectedViewport.width ||
      snapshot.viewport.height !== expectedViewport.height)
      ? [
          `viewport is ${snapshot.viewport.width}x${snapshot.viewport.height}, expected ${expectedViewport.width}x${expectedViewport.height}`,
        ]
      : []),
    ...(horizontalOverflow > (oracle?.maxHorizontalOverflow ?? 0)
      ? [`horizontal overflow is ${horizontalOverflow}px`]
      : []),
    ...(oracle?.maxVerticalOverflow !== undefined &&
    verticalOverflow > oracle.maxVerticalOverflow
      ? [`vertical overflow is ${verticalOverflow}px`]
      : []),
  ];
};

export const evaluateVisual = (
  screenshot: EvidenceRef,
  geometrySnapshot: GeometrySnapshot,
  baseline: BaselineCapture | null,
  oracle: GeometryOracle | undefined,
): VisualEvaluation => {
  const issues = [...geometryIssues(geometrySnapshot, oracle)];
  if (baseline === null && oracle === undefined) {
    issues.push("no immutable visual baseline or geometry oracle was supplied");
  }
  if (baseline !== null && baseline.digest !== screenshot.digest) {
    issues.push(
      `visual digest changed from ${baseline.digest} to ${screenshot.digest}`,
    );
  }
  return {
    outcome: issues.length === 0 ? "pass" : "fail",
    message:
      issues.length === 0
        ? baseline === null
          ? "Stable geometry oracle matched the final capture"
          : "Final screenshot digest exactly matches the immutable baseline"
        : issues.join("; "),
    issues,
    baseline,
    reviewedMasks: [],
  };
};

export const visualArtifact = (
  baseline: BaselineCapture | null,
  screenshot: EvidenceRef,
  geometrySnapshot: GeometrySnapshot,
  oracle: GeometryOracle | undefined,
  visual: VisualEvaluation,
): readonly [string, unknown, EvidenceRef["kind"], EvidenceRef["dimension"]] =>
  [
    "visual-oracle.json",
    {
      baseline,
      finalDigest: screenshot.digest,
      geometry: geometrySnapshot,
      geometryOracle: oracle ?? null,
      reviewedMasks: visual.reviewedMasks,
      outcome: visual.outcome,
      issues: visual.issues,
    },
    "geometry",
    "visual",
  ] satisfies ArtifactSpec;
