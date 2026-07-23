/**
 * @vitest-environment node
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

function sourceFile(path: string): ts.SourceFile {
  const absolutePath = resolve(process.cwd(), path);
  return ts.createSourceFile(
    absolutePath,
    readFileSync(absolutePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

const SEARCH_PARAM_BOUNDARIES = [
  {
    path: "src/app/(app)/head/report/[reportId]/page.tsx",
    owner: "HeadReportShell",
  },
  {
    path: "src/app/(app)/lead/report/[reportId]/page.tsx",
    owner: "LeadForm",
  },
  { path: "src/app/(app)/lead/report/page.tsx", owner: "LeadForm" },
  {
    path: "src/app/(app)/reports/[reportId]/page.tsx",
    owner: "ViewerReportShell",
  },
] as const;

function containsJsxElement(node: ts.Node, name: string): boolean {
  if (
    (ts.isJsxElement(node) && node.openingElement.tagName.getText() === name) ||
    (ts.isJsxSelfClosingElement(node) && node.tagName.getText() === name)
  ) {
    return true;
  }
  return node.getChildren().some((child) => containsJsxElement(child, name));
}

function hasSuspenseBoundary(path: string, owner: string): boolean {
  const file = sourceFile(path);
  const hasFallback = (element: ts.JsxElement): boolean =>
    element.openingElement.attributes.properties.some(
      (attribute) =>
        ts.isJsxAttribute(attribute) &&
        attribute.name.getText(file) === "fallback",
    );
  return file.statements.some((statement) => {
    let found = false;
    const visit = (node: ts.Node): void => {
      if (
        ts.isJsxElement(node) &&
        node.openingElement.tagName.getText(file) === "Suspense" &&
        hasFallback(node) &&
        containsJsxElement(node, owner)
      ) {
        found = true;
      }
      ts.forEachChild(node, visit);
    };
    visit(statement);
    return found;
  });
}

describe("App Router loading ownership", () => {
  it.each(SEARCH_PARAM_BOUNDARIES)(
    "$path wraps $owner in a Suspense boundary with a fallback",
    ({ path, owner }) => expect(hasSuspenseBoundary(path, owner)).toBe(true),
  );
});
