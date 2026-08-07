import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import * as path from "node:path";

import type { Page } from "@playwright/test";

import { type EvidenceRef, evidenceRefSchema } from "../../source/contracts.ts";
import { makeArtifactId } from "../../support/ids.ts";
import type {
  EvidenceCaptureInput,
  GeometryElement,
  GeometrySnapshot,
} from "../evidence-types.ts";

export type ArtifactSpec = readonly [
  string,
  unknown,
  EvidenceRef["kind"],
  EvidenceRef["dimension"],
];

type RawGeometryElement = Readonly<{
  index: number;
  tagName: string;
  role: string | null;
  textContent: string;
  ariaLabel: string | null;
  layoutKey: string | null;
  layoutStability: string | null;
  bounds: Readonly<{ x: number; y: number; width: number; height: number }>;
  style: Readonly<{
    display: string;
    visibility: string;
    opacity: string;
  }>;
  hiddenByAncestor: boolean;
}>;

const GEOMETRY_SELECTOR =
  "a[href],button,input,select,textarea,option,summary,main,header,nav,aside,[contenteditable]:not([contenteditable='false']),[role],[data-layout-key],[aria-busy='true']";

export const digest = (content: Uint8Array): string =>
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

const slug = (value: string): string =>
  value.replaceAll(/[^a-zA-Z0-9]+/g, "-").replaceAll(/^-|-$/g, "") || "root";

export const routeDirectory = (input: EvidenceCaptureInput): string =>
  inside(
    input.archiveRoot,
    path.join(
      input.archiveRoot,
      "routes",
      input.profile,
      input.role,
      slug(input.catalogRoute),
      "cells",
      encodeURIComponent(input.cellId),
      input.capturePhase ?? "before",
    ),
  );

export const writeJson = async (
  input: EvidenceCaptureInput,
  directory: string,
  spec: ArtifactSpec,
): Promise<EvidenceRef> => {
  const [name, value, kind, dimension] = spec;
  const filePath = inside(input.archiveRoot, path.join(directory, name));
  const content = Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
  await writeFile(filePath, content, { flag: "wx" });
  const contentDigest = digest(content);
  return evidenceRefSchema.parse({
    artifactId: makeArtifactId({
      cellId: input.cellId,
      sourceSha: input.sourceSha,
      archivePath: filePath,
      content: contentDigest,
    }),
    kind,
    dimension,
    archivePath: filePath,
    digest: contentDigest,
    capturedAt: input.capturedAt,
    cellId: input.cellId,
    sourceSha: input.sourceSha,
    profile: input.profile,
    role: input.role,
    catalogRoute: input.catalogRoute,
    resolvedRoute: input.resolvedRoute,
  });
};

const rawGeometry = (page: Page): Promise<readonly RawGeometryElement[]> =>
  page.locator(GEOMETRY_SELECTOR).evaluateAll((elements) =>
    elements.map((element, index) => {
      const bounds = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const dataset =
        element instanceof HTMLElement || element instanceof SVGElement
          ? element.dataset
          : undefined;
      return {
        index,
        tagName: element.tagName.toLowerCase(),
        role: element.getAttribute("role"),
        textContent: element.textContent,
        ariaLabel: element.getAttribute("aria-label"),
        layoutKey: dataset?.layoutKey ?? null,
        layoutStability: dataset?.layoutStability ?? null,
        bounds: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        },
        style: {
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
        },
        hiddenByAncestor:
          element.closest("[hidden],[aria-hidden='true']") !== null,
      };
    }),
  );

const stableLayoutFor = (
  value: string | null,
): GeometryElement["layoutStability"] =>
  value === "position-size" || value === "position-width" ? value : null;

const layoutVisibleFor = (raw: RawGeometryElement): boolean =>
  !raw.hiddenByAncestor &&
  raw.style.display !== "none" &&
  raw.style.visibility !== "hidden" &&
  raw.style.visibility !== "collapse" &&
  Number(raw.style.opacity) !== 0;

const geometryElementFor = (
  raw: RawGeometryElement,
): GeometryElement & Readonly<{ issue: string | null }> => {
  const layoutVisible = layoutVisibleFor(raw);
  const malformed = Object.values(raw.bounds).some(
    (value) => !Number.isFinite(value),
  );
  const zeroSize =
    layoutVisible && (raw.bounds.width <= 0 || raw.bounds.height <= 0);
  const issue = malformed
    ? `element ${raw.index} has malformed geometry`
    : zeroSize
      ? `element ${raw.index} has zero-size layout`
      : null;
  return {
    index: raw.index,
    tagName: raw.tagName,
    role: raw.role,
    name: raw.ariaLabel ?? raw.textContent.replaceAll(/\s+/g, " ").trim(),
    layoutKey: raw.layoutKey,
    layoutStability: stableLayoutFor(raw.layoutStability),
    ...raw.bounds,
    layoutVisible,
    visible: layoutVisible && !malformed && !zeroSize,
    issue,
  };
};

const pageGeometry = (page: Page) =>
  page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    document: {
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    },
    loading: {
      busyCount: document.querySelectorAll('[aria-busy="true"]').length,
      skeletonCount: document.querySelectorAll('[data-slot="skeleton"]').length,
    },
  }));

export const captureGeometry = async (
  page: Page,
): Promise<GeometrySnapshot> => {
  const [rawElements, geometry] = await Promise.all([
    rawGeometry(page),
    pageGeometry(page),
  ]);
  const elements = rawElements.map(geometryElementFor);
  return {
    ...geometry,
    elements: elements.map(({ issue: _issue, ...element }) => element),
    issues: elements.flatMap(({ issue }) => (issue === null ? [] : [issue])),
  };
};

export const captureScreenshot = async (
  input: EvidenceCaptureInput,
  directory: string,
): Promise<EvidenceRef> => {
  const filePath = inside(
    input.archiveRoot,
    path.join(directory, "screenshot.png"),
  );
  const content = await input.page.screenshot({ fullPage: true });
  await writeFile(filePath, content, { flag: "wx" });
  const contentDigest = digest(content);
  return evidenceRefSchema.parse({
    artifactId: makeArtifactId({
      cellId: input.cellId,
      sourceSha: input.sourceSha,
      archivePath: filePath,
      content: contentDigest,
    }),
    kind: "screenshot",
    dimension: "visual",
    archivePath: filePath,
    digest: contentDigest,
    capturedAt: input.capturedAt,
    cellId: input.cellId,
    sourceSha: input.sourceSha,
    profile: input.profile,
    role: input.role,
    catalogRoute: input.catalogRoute,
    resolvedRoute: input.resolvedRoute,
  });
};
