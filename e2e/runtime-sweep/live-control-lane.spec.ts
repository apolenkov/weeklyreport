import { expect, test, type TestInfo } from "@playwright/test";

import {
  type DOMControl,
  type EvidenceBundle,
  type Oracle,
} from "./contracts.ts";
import { inventoryDom } from "./dom-inventory.ts";
import { captureRouteEvidence } from "./evidence-capture.ts";
import { writeFrozenCaseArtifact } from "./frozen-case-artifacts.ts";
import { captureFrozenCasePhases } from "./frozen-case-evidence.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";
import { controlEvidence } from "./runtime-matrix-evidence.ts";

const HARNESS_SOURCE_SHA = "c".repeat(40);
const HARNESS_ORACLE: Oracle = {
  domainSpecRefs: ["openspec/spec.md"],
  function: { required: true, expectation: "submitted state is visible" },
  accessibility: {
    required: true,
    expectation: "controls are keyboard usable",
  },
  visual: { required: true, expectation: "desktop geometry has no overflow" },
};

const exercisedActionResult = (
  artifactId: string,
): DOMControl["actionResult"] => ({
  kind: "exercised",
  result: "pass",
  evidenceIds: [artifactId],
});

const frozenHarnessCase = (controlKey: string): MatrixExecutableCase => ({
  caseId: "matrix-harness-submit",
  stateId: "state-matrix-harness-submit",
  sourceSha: HARNESS_SOURCE_SHA,
  profile: "minimal",
  role: "viewer",
  catalogRoute: "/harness",
  resolvedRoute: "/harness",
  state: {
    profileCapability: "canonical-identities",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "none",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  },
  kind: "executable",
  execution: {
    kind: "control",
    action: {
      controlKey,
      operation: "click",
      safety: "read-only",
      transition: "none",
    },
  },
});

const captureHarnessPhase = async (input: {
  readonly page: Parameters<typeof inventoryDom>[0];
  readonly testInfo: TestInfo;
  readonly matrixCase: MatrixExecutableCase;
  readonly phase: "before" | "action" | "after";
}): Promise<EvidenceBundle> => {
  if (input.phase === "action")
    await input.page.getByRole("button", { name: "Submit" }).click();
  await input.page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
  const inventory = await inventoryDom(input.page);
  const captured = await captureRouteEvidence({
    page: input.page,
    archiveRoot: input.testInfo.outputPath("archive"),
    sourceSha: input.matrixCase.sourceSha,
    profile: input.matrixCase.profile,
    role: input.matrixCase.role,
    catalogRoute: input.matrixCase.catalogRoute,
    resolvedRoute: input.matrixCase.resolvedRoute,
    cellId: input.matrixCase.caseId,
    inventory,
    consoleMessages: [],
    pageErrors: [],
    requestFailures: [],
    responseStatus: 200,
    capturedAt: "2026-08-04T00:00:00.000Z",
    capturePhase: input.phase,
    functionalAssertion: {
      assertionId: `harness-${input.phase}-state`,
      expected: { submitted: input.phase !== "before" },
      actual: {
        submitted:
          (await input.page.locator("#status").textContent()) === "Submitted",
      },
      message: `Harness ${input.phase} functional state was observed`,
    },
    geometryOracle: {
      viewport: { width: 1440, height: 900 },
      maxHorizontalOverflow: 0,
      requireNoZeroSize: true,
    },
  });
  if (input.phase !== "action") return captured.bundle;
  if (!("action" in input.matrixCase.execution))
    throw new Error("Harness control case has no action");
  const actionEvidence = await writeFrozenCaseArtifact({
    archiveRoot: input.testInfo.outputPath("archive"),
    sourceSha: input.matrixCase.sourceSha,
    profile: input.matrixCase.profile,
    role: input.matrixCase.role,
    catalogRoute: input.matrixCase.catalogRoute,
    resolvedRoute: input.matrixCase.resolvedRoute,
    cellId: input.matrixCase.caseId,
    phase: "action",
    fileName: "control-actions.json",
    kind: "control-action",
    dimension: "runtime",
    capturedAt: "2026-08-04T00:00:00.000Z",
    value: {
      controlKey: input.matrixCase.execution.action.controlKey,
      status: "pass",
    },
  });
  return {
    ...captured.bundle,
    action: [...captured.bundle.action, actionEvidence],
  };
};
import {
  executeLiveControlPlans,
  planLiveControlActions,
} from "./live-control-lane.ts";

test.describe("runtime live-control lane", () => {
  test("re-inventories and exercises a control revealed by a menu", async ({
    page,
  }) => {
    await page.setContent(`
      <button type="button" id="open">Open menu</button>
      <div id="menu" role="menu" hidden>
        <button type="button">View details</button>
      </div>
      <output id="result"></output>
      <script>
        document.getElementById("open").addEventListener("click", () => {
          document.getElementById("menu").hidden = false;
        });
        document.querySelector("#menu button").addEventListener("click", () => {
          document.getElementById("result").textContent = "Details shown";
        });
      </script>
    `);
    const initial = await inventoryDom(page);
    const records = await executeLiveControlPlans({
      page,
      plans: planLiveControlActions(initial.controls),
      preparePage: () => Promise.resolve(),
      reinventory: async () => (await inventoryDom(page)).controls,
    });

    expect(records.map(({ controlKey }) => controlKey)).toEqual([
      "button:Open%20menu:1",
      "menu:(unnamed):1",
      "button:View%20details:1",
    ]);
    expect(records.map(({ status }) => status)).toEqual([
      "pass",
      "not-exercised",
      "pass",
    ]);
  });

  test("fails a click whose page has no observable URL, DOM, focus, or network outcome", async ({
    page,
  }) => {
    await page.setContent(
      '<button type="button" tabindex="-1">No observable outcome</button>',
    );
    const inventory = await inventoryDom(page);
    const records = await executeLiveControlPlans({
      page,
      plans: planLiveControlActions(inventory.controls),
      preparePage: () => Promise.resolve(),
    });

    expect(records[0]?.status).toBe("fail");
  });

  test("observes a switch transition through aria-checked", async ({
    page,
  }) => {
    await page.setContent(`
      <button type="button" role="switch" aria-label="Notifications" aria-checked="false">Notifications</button>
      <script>
        document.querySelector('[role="switch"]').addEventListener("click", (event) => {
          const switchControl = event.currentTarget;
          switchControl.setAttribute(
            "aria-checked",
            switchControl.getAttribute("aria-checked") === "true" ? "false" : "true",
          );
        });
      </script>
    `);
    const inventory = await inventoryDom(page);
    const records = await executeLiveControlPlans({
      page,
      plans: planLiveControlActions(inventory.controls),
      preparePage: () => Promise.resolve(),
    });

    expect(records[0]).toMatchObject({
      status: "pass",
      observation: { kind: "dom" },
    });
  });

  test("observes skip-to-content focus and scroll without accepting ordinary focus", async ({
    page,
  }) => {
    await page.setContent(`
      <button type="button" aria-label="Skip to content">Skip to content</button>
      <div style="height: 900px"></div>
      <main id="main-content" tabindex="-1">Report content</main>
      <script>
        document.querySelector("button").addEventListener("click", () => {
          const main = document.getElementById("main-content");
          main.focus();
          window.scrollTo(0, 480);
        });
      </script>
    `);
    const inventory = await inventoryDom(page);
    const records = await executeLiveControlPlans({
      page,
      plans: planLiveControlActions(inventory.controls),
      preparePage: () => Promise.resolve(),
    });

    expect(records[0]).toMatchObject({
      status: "pass",
      observation: { kind: "focus" },
    });
  });
});

test("replays a frozen control through before/action/after evidence", async ({
  page,
}, testInfo) => {
  await page.setContent(`
    <html lang="en"><head><title>Harness</title></head><body><main>
      <h1>Harness</h1>
      <button type="button">Submit</button>
      <output id="status">Idle</output>
      <script>
        document.querySelector("button").addEventListener("click", () => {
          document.querySelector("#status").textContent = "Submitted";
        });
      </script>
    </main></body></html>
  `);
  const inventory = await inventoryDom(page);
  const control = inventory.controls[0];
  if (control === undefined)
    throw new Error("Harness button inventory is empty");
  const matrixCase = frozenHarnessCase(control.controlKey);
  const result = await captureFrozenCasePhases({
    matrixCase,
    oracle: HARNESS_ORACLE,
    controls: (evidence) => {
      const actionEvidence = evidence.action.action.find(
        ({ kind }) => kind === "control-action",
      );
      if (actionEvidence === undefined)
        throw new Error("Harness action evidence is missing");
      return controlEvidence(inventory, matrixCase.caseId).map((candidate) =>
        candidate.controlKey === control.controlKey
          ? {
              ...candidate,
              actionResult: exercisedActionResult(actionEvidence.artifactId),
            }
          : candidate,
      );
    },
    capturePhase: (phase) =>
      captureHarnessPhase({ page, testInfo, matrixCase, phase }),
  });

  expect(result.cell.cellId).toBe(matrixCase.caseId);
  expect(result.cell.execution).toEqual(matrixCase.execution);
  expect(result.cell.evidence.before).not.toHaveLength(0);
  expect(result.cell.evidence.action).not.toHaveLength(0);
  expect(result.cell.evidence.after).not.toHaveLength(0);
  expect(result.issues, result.issues.join("; ")).toEqual([]);
  expect(result.cell.verdict).toBe("pass");
});
