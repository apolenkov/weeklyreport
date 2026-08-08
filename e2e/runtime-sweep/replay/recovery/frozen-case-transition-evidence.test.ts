import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { digest } from "../../evidence/capture/artifacts.ts";
import { FROZEN_LIVE_TRANSITION_VISUAL_POLICY } from "../../evidence/transition-visual-evaluation.ts";
import { attachTransitionVisualEvidence } from "../../evidence/transition-visual-evidence.ts";
import type { MatrixExecutableCase } from "../../matrix/matrix-finalizer.ts";
import {
  type EvidenceBundle,
  evidenceBundleSchema,
  type EvidenceRef,
  evidenceRefSchema,
} from "../../source/contracts.ts";
import {
  type CompleteFrozenCaseEvidence,
  transitionEvidenceSelection,
} from "../frozen-case-evidence.ts";
import { phaseIssues } from "../frozen-case-phase-validation.ts";

const SOURCE_SHA = "a".repeat(40);
const CASE_ID = "case-stateful-transition";
const CAPTURED_AT = "2026-08-08T00:00:00.000Z";

const matrixCase: MatrixExecutableCase = {
  caseId: CASE_ID,
  stateId: "state-stateful-transition",
  sourceSha: SOURCE_SHA,
  profile: "minimal",
  role: "lead",
  catalogRoute: "/lead/report",
  resolvedRoute: "/lead/report",
  state: {
    profileCapability: "editable-active-report",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "owner",
    fault: "none",
    controlTransition: "submit",
  },
  kind: "executable",
  execution: {
    kind: "control",
    action: {
      controlKey: "button:Submit:1",
      operation: "submit",
      safety: "irreversible",
      transition: "submit",
    },
  },
};

const geometry = (x: number) => ({
  viewport: { width: 1440, height: 900 },
  document: { scrollWidth: 1440, scrollHeight: 1200 },
  loading: { busyCount: 0, skeletonCount: 0 },
  elements: [
    {
      index: 0,
      tagName: "main",
      role: "main",
      name: "Report",
      layoutKey: "report-page",
      layoutStability: "position-width",
      x,
      y: 100,
      width: 1200,
      height: 900,
      layoutVisible: true,
      visible: true,
    },
  ],
  issues: [],
});

type Phase = "before" | "action" | "after";
type Artifact = Readonly<{
  readonly fileName: string;
  readonly kind: EvidenceRef["kind"];
  readonly dimension: EvidenceRef["dimension"];
  readonly content: Buffer;
}>;

const artifacts = (phase: Phase, x: number): readonly Artifact[] => [
  {
    fileName: "screenshot.png",
    kind: "screenshot",
    dimension: "visual",
    content: Buffer.from(`screenshot-${phase}`),
  },
  {
    fileName: "geometry.json",
    kind: "geometry",
    dimension: "visual",
    content: Buffer.from(`${JSON.stringify(geometry(x))}\n`),
  },
  {
    fileName: "url.json",
    kind: "url",
    dimension: "runtime",
    content: Buffer.from(
      `${JSON.stringify({ url: "http://127.0.0.1:3105/lead/report", status: 200 })}\n`,
    ),
  },
];

const writeArtifact = async (
  root: string,
  phase: Phase,
  artifact: Artifact,
): Promise<EvidenceRef> => {
  const archivePath = path.join(root, "fixtures", phase, artifact.fileName);
  await mkdir(path.dirname(archivePath), { recursive: true });
  await writeFile(archivePath, artifact.content, { flag: "wx" });
  return evidenceRefSchema.parse({
    artifactId: `${phase}-${artifact.fileName}`,
    kind: artifact.kind,
    dimension: artifact.dimension,
    archivePath,
    digest: digest(artifact.content),
    capturedAt: CAPTURED_AT,
    cellId: CASE_ID,
    sourceSha: SOURCE_SHA,
    profile: "minimal",
    role: "lead",
    catalogRoute: "/lead/report",
    resolvedRoute: "/lead/report",
  });
};

const phaseBundle = async (
  root: string,
  phase: Phase,
  x: number,
): Promise<EvidenceBundle> => {
  const refs = await Promise.all(
    artifacts(phase, x).map((artifact) => writeArtifact(root, phase, artifact)),
  );
  return evidenceBundleSchema.parse({
    before: phase === "before" ? refs : [],
    action: phase === "action" ? refs : [],
    after: phase === "after" ? refs : [],
    observations: [],
    inapplicable: [],
  });
};

describe("stateful transition evidence", () => {
  it("compares the action result instead of the restored baseline", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "runtime-stateful-transition-"),
    );
    try {
      const captured: CompleteFrozenCaseEvidence = {
        before: await phaseBundle(root, "before", 100),
        action: await phaseBundle(root, "action", 180),
        after: await phaseBundle(root, "after", 100),
      };
      const selection = transitionEvidenceSelection(matrixCase, captured);

      expect(selection.resultPhase).toBe("action");
      const attached = await attachTransitionVisualEvidence({
        archiveRoot: root,
        matrixCase,
        before: captured.before,
        ...selection,
        attachTo: captured.after,
        policy: FROZEN_LIVE_TRANSITION_VISUAL_POLICY,
      });
      const transition = attached.observations.find(
        ({ observationId }) => observationId === "transition-visual",
      );
      const transitionRef = attached.after.find(
        ({ archivePath }) =>
          path.basename(archivePath) === "transition-visual.json",
      );
      if (transitionRef === undefined)
        throw new Error("Transition visual artifact is missing");
      const transitionArtifact: unknown = JSON.parse(
        await readFile(transitionRef.archivePath, "utf8"),
      );
      const refs = [
        ...captured.before.before,
        ...captured.action.action,
        ...attached.after,
      ];
      const issues = phaseIssues(
        CASE_ID,
        { phase: "after", bundle: attached, refs: attached.after },
        refs,
      );

      expect(transition?.outcome).toBe("fail");
      expect(transitionArtifact).toMatchObject({
        schemaVersion: 2,
        evaluation: { comparison: "same-view-landmarks" },
      });
      expect(transition?.message).toContain(
        "stable layout key report-page moved outside",
      );
      expect(issues.join(" ")).toContain(
        "after observation transition-visual failed",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
