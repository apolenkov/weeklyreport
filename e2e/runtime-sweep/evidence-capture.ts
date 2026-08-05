import { mkdir } from "node:fs/promises";

import { z } from "zod";

import { finalizeAxeContext, prepareAxeContext } from "./axe-context.ts";
import { evidenceBundleSchema, type EvidenceRef } from "./contracts.ts";
import { inventoryDom } from "./dom-inventory.ts";
import {
  captureGeometry,
  captureScreenshot,
  routeDirectory,
  writeJson,
} from "./evidence-capture/artifacts.ts";
import { observations } from "./evidence-capture/observations.ts";
import {
  evaluateVisual,
  functionalPayload,
  readVisualBaseline,
  visualArtifact,
} from "./evidence-capture/visual-oracle.ts";
import type {
  EvidenceCaptureInput,
  EvidenceCaptureResult,
  EvidencePhase,
  GeometrySnapshot,
} from "./evidence-types.ts";
import {
  captureKeyboardTrace,
  type KeyboardTrace,
} from "./keyboard-evidence.ts";

type ArtifactSpec = readonly [
  string,
  unknown,
  EvidenceRef["kind"],
  EvidenceRef["dimension"],
];
type CapturedJson = Readonly<{
  refs: readonly EvidenceRef[];
  violations: readonly unknown[];
}>;

const PAGE_ERROR_KIND = "page-error" as const;
const RUNTIME_DIMENSION = "runtime" as const;
const DEFAULT_PHASE: EvidencePhase = "before";

const captureJson = async (
  input: EvidenceCaptureInput,
  directory: string,
  axe: unknown,
  keyboard: KeyboardTrace,
  geometrySnapshot: GeometrySnapshot,
): Promise<CapturedJson> => {
  const functionalSpec: readonly ArtifactSpec[] = input.functionalAssertion
    ? [
        [
          "functional.json",
          functionalPayload(input.functionalAssertion),
          "api",
          "function",
        ],
      ]
    : [];
  const specs: readonly ArtifactSpec[] = [
    ["dom.json", input.inventory, "dom", "accessibility"],
    ["console.json", input.consoleMessages, "console", RUNTIME_DIMENSION],
    ["page-errors.json", input.pageErrors, PAGE_ERROR_KIND, RUNTIME_DIMENSION],
    [
      "request-failures.json",
      input.requestFailures,
      "request",
      RUNTIME_DIMENSION,
    ],
    [
      "url.json",
      { url: input.page.url(), status: input.responseStatus },
      "url",
      RUNTIME_DIMENSION,
    ],
    ["axe.json", axe, "axe", "accessibility"],
    ["keyboard.json", keyboard, "keyboard", "accessibility"],
    ["geometry.json", geometrySnapshot, "geometry", "visual"],
    ...functionalSpec,
  ];
  const refs = await Promise.all(
    specs.map((spec) => writeJson(input, directory, spec)),
  );
  return {
    refs,
    violations: z.object({ violations: z.array(z.unknown()) }).parse(axe)
      .violations,
  };
};

const phaseBundle = (
  phase: EvidencePhase,
  all: readonly EvidenceRef[],
): Readonly<{
  before: readonly EvidenceRef[];
  action: readonly EvidenceRef[];
  after: readonly EvidenceRef[];
}> => ({
  before: phase === "before" ? all : [],
  action: phase === "action" ? all : [],
  after: phase === "after" ? all : [],
});

const inventoryFor = (
  input: EvidenceCaptureInput,
): Promise<EvidenceCaptureInput["inventory"]> =>
  input.capturePhase === "action"
    ? inventoryDom(input.page)
    : Promise.resolve(input.inventory);

export async function captureRouteEvidence(
  input: EvidenceCaptureInput,
): Promise<EvidenceCaptureResult> {
  const directory = routeDirectory(input);
  await mkdir(directory, { recursive: true });
  const baseline = await readVisualBaseline(input, directory);
  const axeContext = await prepareAxeContext(input.page);
  const captureInput = { ...input, inventory: await inventoryFor(input) };
  const keyboard = await captureKeyboardTrace(
    input.page,
    captureInput.inventory.controls,
  );
  const geometrySnapshot = await captureGeometry(input.page);
  const screenshot = await captureScreenshot(input, directory);
  const axe = await finalizeAxeContext(input.page, axeContext);
  const captured = await captureJson(
    captureInput,
    directory,
    axe,
    keyboard,
    geometrySnapshot,
  );
  const visual = evaluateVisual(
    screenshot,
    geometrySnapshot,
    baseline,
    input.geometryOracle,
  );
  const visualOracle = await writeJson(
    input,
    directory,
    visualArtifact(
      baseline,
      screenshot,
      geometrySnapshot,
      input.geometryOracle,
      visual,
    ),
  );
  const all = Object.freeze([...captured.refs, screenshot, visualOracle]);
  const functional = input.functionalAssertion
    ? functionalPayload(input.functionalAssertion)
    : null;
  const phase = input.capturePhase ?? DEFAULT_PHASE;
  const bundle = evidenceBundleSchema.parse({
    ...phaseBundle(phase, all),
    observations: observations(
      input,
      captured.refs,
      screenshot,
      visualOracle,
      visual,
      captured.violations,
      keyboard,
      functional,
    ),
    inapplicable: functional
      ? []
      : [
          {
            dimension: "function",
            reason:
              "Route capture observed navigation only; a functionalAssertion is required for functional evidence",
          },
        ],
  });
  return { bundle, all };
}
