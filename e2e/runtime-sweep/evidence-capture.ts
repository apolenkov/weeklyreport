import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { z } from "zod";

import {
  evidenceBundleSchema,
  evidenceObservationSchema,
  type EvidenceRef,
  evidenceRefSchema,
} from "./contracts.ts";
import type {
  EvidenceCaptureInput,
  EvidenceCaptureResult,
} from "./evidence-types.ts";
import { makeArtifactId } from "./ids.ts";
import {
  captureKeyboardTrace,
  type KeyboardTrace,
} from "./keyboard-evidence.ts";
type Observation = z.infer<typeof evidenceObservationSchema>;
type ArtifactSpec = readonly [
  string,
  unknown,
  EvidenceRef["kind"],
  EvidenceRef["dimension"],
];
type CountObservation = readonly [
  string,
  Observation["kind"],
  number,
  string,
  EvidenceRef["kind"],
];
const OK_STATUS_LIMIT = 400;
const RUNTIME_DIMENSION = "runtime" as const;
const PAGE_ERROR_KIND = "page-error" as const;
const slug = (value: string): string =>
  value.replaceAll(/[^a-zA-Z0-9]+/g, "-").replaceAll(/^-|-$/g, "") || "root";
const digest = (content: Uint8Array): string =>
  createHash("sha256").update(content).digest("hex");
const inside = (root: string, candidate: string): string => {
  const rootPath = path.resolve(root);
  const candidatePath = path.resolve(candidate);
  if (
    candidatePath !== rootPath &&
    !candidatePath.startsWith(`${rootPath}${path.sep}`)
  )
    throw new Error(`Runtime sweep artifact escaped archive: ${candidatePath}`);
  return candidatePath;
};
const routeDirectory = (input: EvidenceCaptureInput): string =>
  inside(
    input.archiveRoot,
    path.join(
      input.archiveRoot,
      "routes",
      input.profile,
      input.role,
      slug(input.catalogRoute),
    ),
  );
const writeJson = async (
  input: EvidenceCaptureInput,
  directory: string,
  spec: ArtifactSpec,
): Promise<EvidenceRef> => {
  const [name, value, kind, dimension] = spec;
  const filePath = inside(input.archiveRoot, path.join(directory, name));
  const content = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  await writeFile(filePath, content);
  return evidenceRefSchema.parse({
    artifactId: makeArtifactId({
      cellId: input.cellId,
      sourceSha: input.sourceSha,
      archivePath: filePath,
      content: digest(content),
    }),
    kind,
    dimension,
    archivePath: filePath,
    digest: digest(content),
    capturedAt: input.capturedAt,
    cellId: input.cellId,
    sourceSha: input.sourceSha,
    profile: input.profile,
    role: input.role,
    catalogRoute: input.catalogRoute,
    resolvedRoute: input.resolvedRoute,
  });
};
const geometry = (page: Page): Promise<unknown> =>
  page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    document: {
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    },
    elements: Array.from(
      document.querySelectorAll(
        "a[href],button,input,select,textarea,[role],[contenteditable='true']",
      ),
    ).map((element, index) => {
      const bounds = element.getBoundingClientRect();
      return {
        index,
        tagName: element.tagName.toLowerCase(),
        role: element.getAttribute("role"),
        name: element.getAttribute("aria-label") ?? element.textContent.trim(),
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        visible: bounds.width > 0 && bounds.height > 0,
      };
    }),
  }));
const captureJson = async (
  input: EvidenceCaptureInput,
  directory: string,
  axe: unknown,
  keyboard: KeyboardTrace,
): Promise<
  Readonly<{ refs: readonly EvidenceRef[]; violations: readonly unknown[] }>
> => {
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
    ["geometry.json", await geometry(input.page), "geometry", "visual"],
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
const captureScreenshot = async (
  input: EvidenceCaptureInput,
  directory: string,
): Promise<EvidenceRef> => {
  const filePath = inside(
    input.archiveRoot,
    path.join(directory, "screenshot.png"),
  );
  const content = await input.page.screenshot({ fullPage: true });
  await writeFile(filePath, content);
  const hash = digest(content);
  return evidenceRefSchema.parse({
    artifactId: makeArtifactId({
      cellId: input.cellId,
      sourceSha: input.sourceSha,
      archivePath: filePath,
      content: hash,
    }),
    kind: "screenshot",
    dimension: "visual",
    archivePath: filePath,
    digest: hash,
    capturedAt: input.capturedAt,
    cellId: input.cellId,
    sourceSha: input.sourceSha,
    profile: input.profile,
    role: input.role,
    catalogRoute: input.catalogRoute,
    resolvedRoute: input.resolvedRoute,
  });
};
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
const observations = (
  input: EvidenceCaptureInput,
  refs: readonly EvidenceRef[],
  screenshot: EvidenceRef,
  violations: readonly unknown[],
  keyboard: KeyboardTrace,
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
    evidenceObservationSchema.parse({
      observationId: "keyboard",
      kind: "keyboard",
      outcome: keyboard.focusMoved ? "pass" : "fail",
      message: keyboard.focusMoved
        ? "Tab moved focus to a visible control"
        : "Tab did not move focus to a visible control",
      evidenceIds: [byKind(refs, "keyboard").artifactId],
    }),
    evidenceObservationSchema.parse({
      observationId: "navigation",
      kind: "api",
      outcome:
        input.responseStatus !== null && input.responseStatus < OK_STATUS_LIMIT
          ? "pass"
          : "fail",
      message: `Navigation returned HTTP ${input.responseStatus ?? "no response"}`,
      evidenceIds: [byKind(refs, "url").artifactId],
    }),
    evidenceObservationSchema.parse({
      observationId: "geometry",
      kind: "geometry",
      outcome: "pass",
      message: "Viewport and full-page geometry captured",
      evidenceIds: [byKind(refs, "geometry").artifactId, screenshot.artifactId],
    }),
  ]);
};
export async function captureRouteEvidence(
  input: EvidenceCaptureInput,
): Promise<EvidenceCaptureResult> {
  const directory = routeDirectory(input);
  await mkdir(directory, { recursive: true });
  const axe = await new AxeBuilder({ page: input.page }).analyze();
  const keyboard = await captureKeyboardTrace(input.page);
  const captured = await captureJson(input, directory, axe, keyboard);
  const screenshot = await captureScreenshot(input, directory);
  const all = Object.freeze([...captured.refs, screenshot]);
  const bundle = evidenceBundleSchema.parse({
    before: all,
    action: [],
    after: [],
    observations: observations(
      input,
      captured.refs,
      screenshot,
      captured.violations,
      keyboard,
    ),
    inapplicable: [],
  });
  return { bundle, all };
}
