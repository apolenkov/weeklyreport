import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import * as path from "node:path";

import type { Page } from "@playwright/test";

import { type EvidenceRef, evidenceRefSchema } from "../../source/contracts.ts";
import { makeArtifactId } from "../../support/ids.ts";
import type {
  EvidenceCaptureInput,
  GeometrySnapshot,
} from "../evidence-types.ts";

export type ArtifactSpec = readonly [
  string,
  unknown,
  EvidenceRef["kind"],
  EvidenceRef["dimension"],
];

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

export const captureGeometry = (page: Page): Promise<GeometrySnapshot> =>
  page.evaluate(() => {
    const elements = Array.from(
      document.querySelectorAll(
        "a[href],button,input,select,textarea,option,summary,[contenteditable]:not([contenteditable='false']),[role]",
      ),
    ).map((element, index) => {
      const bounds = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const layoutVisible =
        !element.closest("[hidden],[aria-hidden='true']") &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.visibility !== "collapse" &&
        Number(style.opacity) !== 0;
      const values = [bounds.x, bounds.y, bounds.width, bounds.height];
      const malformed = values.some((value) => !Number.isFinite(value));
      const zeroSize =
        layoutVisible && (bounds.width <= 0 || bounds.height <= 0);
      const ariaLabel = element.getAttribute("aria-label");
      return {
        index,
        tagName: element.tagName.toLowerCase(),
        role: element.getAttribute("role"),
        name: ariaLabel ?? element.textContent.replaceAll(/\s+/g, " ").trim(),
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        layoutVisible,
        visible: layoutVisible && !malformed && !zeroSize,
        issue: malformed
          ? `element ${index} has malformed geometry`
          : zeroSize
            ? `element ${index} has zero-size layout`
            : null,
      };
    });
    const issues = elements.flatMap(({ issue }) =>
      issue === null ? [] : [issue],
    );
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      },
      elements: elements.map(({ issue: _issue, ...element }) => element),
      issues,
    };
  });

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
