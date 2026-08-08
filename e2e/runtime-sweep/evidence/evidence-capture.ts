import { mkdir } from "node:fs/promises";

import {
  type AxeContextResults,
  axeEvidenceFor,
  finalizeAxeContext,
  prepareAxeContext,
} from "../replay/axe-context.ts";
import { inventoryDom } from "../replay/dom-inventory.ts";
import {
  captureKeyboardTrace,
  type KeyboardTrace,
} from "../replay/keyboard-evidence.ts";
import { evidenceBundleSchema, type EvidenceRef } from "../source/contracts.ts";
import {
  captureGeometry,
  captureScreenshot,
  routeDirectory,
  writeJson,
} from "./capture/artifacts.ts";
import { observations } from "./capture/observations.ts";
import {
  evaluateVisual,
  functionalPayload,
  readVisualBaseline,
  visualArtifact,
} from "./capture/visual-oracle.ts";
import type {
  EvidenceCaptureInput,
  EvidenceCaptureResult,
  EvidencePhase,
  GeometrySnapshot,
  ServerLogEvidence,
} from "./evidence-types.ts";
import { collectServerLogEvidence } from "./server-log-evidence.ts";

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
  axe: AxeContextResults,
  keyboard: KeyboardTrace,
  geometrySnapshot: GeometrySnapshot,
  serverLogs: ServerLogEvidence | null,
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
      "response-ledger.json",
      input.responses ?? [],
      "request",
      RUNTIME_DIMENSION,
    ],
    [
      "url.json",
      { url: input.page.url(), status: input.responseStatus },
      "url",
      RUNTIME_DIMENSION,
    ],
    ["axe.json", axeEvidenceFor(axe), "axe", "accessibility"],
    ["keyboard.json", keyboard, "keyboard", "accessibility"],
    ["geometry.json", geometrySnapshot, "geometry", "visual"],
    ...(serverLogs === null
      ? []
      : ([
          ["server-logs.json", serverLogs, "log", RUNTIME_DIMENSION],
        ] as const)),
    ...functionalSpec,
  ];
  const refs = await Promise.all(
    specs.map((spec) => writeJson(input, directory, spec)),
  );
  return {
    refs,
    violations: axe.violations,
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

const keyboardFor = (input: EvidenceCaptureInput): Promise<KeyboardTrace> =>
  captureKeyboardTrace(input.page, input.inventory.controls);

const serverLogsFor = (
  input: EvidenceCaptureInput,
): Promise<ServerLogEvidence | null> =>
  input.serverLogPath === undefined
    ? Promise.resolve(null)
    : collectServerLogEvidence({
        path: input.serverLogPath,
        responses: input.responses ?? [],
        startedAt: input.phaseStartedAt ?? input.capturedAt,
        endedAt: new Date().toISOString(),
      });

export async function captureRouteEvidence(
  input: EvidenceCaptureInput,
): Promise<EvidenceCaptureResult> {
  const directory = routeDirectory(input);
  await mkdir(directory, { recursive: true });
  const baseline = await readVisualBaseline(input, directory);
  // Freeze the transition boundary before keyboard traversal, focus changes,
  // axe injection, or any other evidence instrumentation can alter the page.
  const screenshot = await captureScreenshot(input, directory);
  const geometrySnapshot = await captureGeometry(input.page);
  const axeContext = await prepareAxeContext(input.page);
  const captureInput = { ...input, inventory: await inventoryFor(input) };
  const keyboard = await keyboardFor(captureInput);
  const axe = await finalizeAxeContext(input.page, axeContext);
  await input.settleRuntimeEvents?.();
  const serverLogs = await serverLogsFor(input);
  const captured = await captureJson(
    captureInput,
    directory,
    axe,
    keyboard,
    geometrySnapshot,
    serverLogs,
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
      serverLogs,
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
