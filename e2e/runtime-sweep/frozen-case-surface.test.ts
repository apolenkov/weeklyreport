import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { expect, test, vi } from "vitest";

import { evidenceRefSchema } from "./contracts.ts";
import { controlIssues } from "./frozen-case-evidence-validation.ts";
import { controlsForCase } from "./frozen-case-live-actions.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";
import {
  LEAD_FORM_UNAVAILABLE_MARKER,
  type RuntimeSurfaceObservation,
} from "./runtime-surface-expectation.ts";

vi.mock("../integration/helpers/db.ts", () => ({ prisma: {} }));
vi.mock("../sweep/helpers/dev-auth.ts", () => ({
  loginByCookie: vi.fn(),
}));

const matrixCase: MatrixExecutableCase = {
  caseId: "case-denied-product-action",
  stateId: "state-denied-product-action",
  sourceSha: "a".repeat(40),
  profile: "minimal",
  role: "lead",
  catalogRoute: "/lead/report/[reportId]",
  resolvedRoute: "/lead/report/report-id",
  state: {
    profileCapability: "editable-active-report",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "non-owner",
    fault: "none",
    controlTransition: "none",
  },
  kind: "executable",
  execution: {
    kind: "control",
    action: {
      controlKey: "button:Edit:1",
      operation: "click",
      safety: "read-only",
      transition: "none",
    },
  },
};

const actionControlKey =
  "action" in matrixCase.execution
    ? matrixCase.execution.action.controlKey
    : "button:Edit:1";

const deniedSurface = {
  productContent: "denied" as const,
  productActions: "inapplicable" as const,
  productActionsReason:
    "The lead report form has no section for the current account.",
  shell: "required" as const,
};

const observedUnavailableSurface: RuntimeSurfaceObservation = {
  productContent: "denied",
  productActions: "inapplicable",
  marker: {
    kind: "lead-form-unavailable",
    present: true,
    heading: { text: LEAD_FORM_UNAVAILABLE_MARKER.heading, count: 1 },
    status: { text: LEAD_FORM_UNAVAILABLE_MARKER.status, count: 1 },
  },
};

const frozenActionTarget = {
  controlKey: actionControlKey,
  domOrderKey: `0001:${actionControlKey}`,
  order: 1,
  role: "button",
  accessibleName: "Edit",
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
} as const;

const exercised = (result: "pass" | "fail") => ({
  kind: "exercised" as const,
  result,
  evidenceIds: ["live-surface-proof"],
});

const evidenceRefFor = (archivePath: string) =>
  evidenceRefSchema.parse({
    artifactId: "live-surface-proof",
    kind: "control-action",
    dimension: "runtime",
    archivePath,
    digest: "b".repeat(64),
    capturedAt: "2026-08-05T00:00:00.000Z",
    cellId: matrixCase.caseId,
    sourceSha: matrixCase.sourceSha,
    profile: matrixCase.profile,
    role: matrixCase.role,
    catalogRoute: matrixCase.catalogRoute,
    resolvedRoute: matrixCase.resolvedRoute,
  });

test("never invents an absent denied-surface control", () => {
  expect(
    controlsForCase(
      { controls: [], issues: [] },
      matrixCase,
      {
        kind: "not-exercised",
        policy: "inapplicable",
        reason: "The live action was not exercised",
      },
      deniedSurface,
    ),
  ).toEqual([]);
});

test("keeps a missing action failing without live unavailable-surface evidence", () => {
  expect(controlIssues(matrixCase, [], [], deniedSurface)).toContain(
    "case-denied-product-action is missing frozen control button:Edit:1",
  );
});

test("accepts a missing action only when its live artifact proves the marker", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "runtime-surface-"));
  const archivePath = path.join(directory, "control-actions.json");
  try {
    await writeFile(
      archivePath,
      `${JSON.stringify(
        {
          outcome: {
            status: "not-exercised",
            controlKey: actionControlKey,
            surfaceObservation: observedUnavailableSurface,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    expect(
      controlIssues(
        matrixCase,
        [],
        [evidenceRefFor(archivePath)],
        deniedSurface,
      ),
    ).toEqual([]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("retains an exercised frozen target when the post-action control is renamed", () => {
  const controls = controlsForCase(
    {
      controls: [
        {
          ...frozenActionTarget,
          controlKey: "button:Edit%20report:1",
          accessibleName: "Edit report",
          domOrderKey: "0001:button:Edit%20report:1",
        },
      ],
      issues: [],
    },
    matrixCase,
    exercised("pass"),
    deniedSurface,
    frozenActionTarget,
  );

  expect(controls).toContainEqual({
    controlKey: actionControlKey,
    cellId: matrixCase.caseId,
    ariaRole: "button",
    accessibleName: "Edit",
    enabled: true,
    order: 1,
    actionResult: exercised("pass"),
  });
  expect(
    controlIssues(matrixCase, controls, [evidenceRefFor("/action")]),
  ).toEqual([]);
});

test("keeps a synthetic frozen target in canonical DOM order", () => {
  const controls = controlsForCase(
    {
      controls: [
        {
          ...frozenActionTarget,
          controlKey: "button:Later:1",
          domOrderKey: "0003:button:Later:1",
          accessibleName: "Later",
          order: 3,
        },
      ],
      issues: [],
    },
    matrixCase,
    exercised("pass"),
    deniedSurface,
    frozenActionTarget,
  );

  expect(controls.map(({ controlKey }) => controlKey)).toEqual([
    actionControlKey,
    "button:Later:1",
  ]);
});

test.each([
  ["no pre-action target", exercised("pass"), undefined],
  ["failed action", exercised("fail"), frozenActionTarget],
] as const)(
  "keeps a missing frozen target failing when %s",
  (_reason, actionResult, target) => {
    const controls = controlsForCase(
      { controls: [], issues: [] },
      matrixCase,
      actionResult,
      deniedSurface,
      target,
    );

    expect(controlIssues(matrixCase, controls, [])).toContain(
      "case-denied-product-action is missing frozen control button:Edit:1",
    );
  },
);
