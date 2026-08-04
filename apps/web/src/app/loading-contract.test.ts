// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

function sourceFileFromText(path: string, text: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    text,
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

// The detection predicate, extracted over an in-memory source so a planted
// positive/negative probe pins what it catches.
export function hasSuspenseBoundaryInSource(
  source: string,
  owner: string,
): boolean {
  const file = sourceFileFromText("page.tsx", source);
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

function hasSuspenseBoundary(path: string, owner: string): boolean {
  return hasSuspenseBoundaryInSource(
    readFileSync(resolve(process.cwd(), path), "utf8"),
    owner,
  );
}

describe("App Router loading ownership — predicate probes", () => {
  it("detects the owner inside a Suspense boundary with a fallback", () => {
    const source = `
      export default function Page() {
        return (
          <Suspense fallback={<Loading />}>
            <HeadReportShell />
          </Suspense>
        );
      }
    `;
    expect(hasSuspenseBoundaryInSource(source, "HeadReportShell")).toBe(true);
  });

  it("detects the owner through a nested wrapper inside the boundary", () => {
    const source = `
      export default function Page() {
        return (
          <Suspense fallback={<Loading />}>
            <Deferred>
              <LeadForm />
            </Deferred>
          </Suspense>
        );
      }
    `;
    expect(hasSuspenseBoundaryInSource(source, "LeadForm")).toBe(true);
  });

  it("does not pass when the Suspense boundary lacks a fallback", () => {
    const source = `
      export default function Page() {
        return (
          <Suspense>
            <HeadReportShell />
          </Suspense>
        );
      }
    `;
    expect(hasSuspenseBoundaryInSource(source, "HeadReportShell")).toBe(false);
  });

  it("does not pass when the owner sits outside the boundary", () => {
    const source = `
      export default function Page() {
        return (
          <>
            <Suspense fallback={<Loading />} />
            <HeadReportShell />
          </>
        );
      }
    `;
    expect(hasSuspenseBoundaryInSource(source, "HeadReportShell")).toBe(false);
  });

  it.each(SEARCH_PARAM_BOUNDARIES)(
    "$path wraps $owner in a Suspense boundary with a fallback",
    ({ path, owner }) => expect(hasSuspenseBoundary(path, owner)).toBe(true),
  );
});
