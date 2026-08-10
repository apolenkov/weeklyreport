import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const MAIN_CONTENT_ROUTES = [
  "src/app/login-page.client.tsx",
  "src/app/auth/error/page.tsx",
  "src/app/(app)/admin/page.tsx",
  "src/app/(app)/head/dashboard/page.tsx",
  "src/app/(app)/head/report/page.tsx",
  "src/app/(app)/head/report/[reportId]/page.tsx",
  "src/app/(app)/lead/report/page.tsx",
  "src/app/(app)/lead/report/[reportId]/page.tsx",
  "src/app/(app)/lead/report/[reportId]/preview/page.tsx",
  "src/app/(app)/reports/page.tsx",
  "src/app/(app)/reports/[reportId]/page.tsx",
  "src/app/(app)/reports/latest/page.tsx",
  "src/app/(app)/reports/trends/page.tsx",
  "src/app/print/[reportId]/print-report-shell.tsx",
  "src/app/print/[reportId]/print-report-template.tsx",
] as const;

function sourceFileFromText(path: string, text: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function hasStringAttribute(
  node: ts.JsxOpeningLikeElement,
  name: string,
  expected: string,
): boolean {
  return node.attributes.properties.some((property) => {
    if (!ts.isJsxAttribute(property) || property.name.getText() !== name) {
      return false;
    }
    const initializer = property.initializer;
    return (
      initializer !== undefined &&
      ts.isStringLiteral(initializer) &&
      initializer.text === expected
    );
  });
}

function hasNegativeOneTabIndex(node: ts.JsxOpeningLikeElement): boolean {
  return node.attributes.properties.some((property) => {
    if (
      !ts.isJsxAttribute(property) ||
      property.name.getText() !== "tabIndex" ||
      !property.initializer ||
      !ts.isJsxExpression(property.initializer) ||
      !property.initializer.expression
    ) {
      return false;
    }

    const expression = property.initializer.expression;
    return (
      ts.isPrefixUnaryExpression(expression) &&
      expression.operator === ts.SyntaxKind.MinusToken &&
      ts.isNumericLiteral(expression.operand) &&
      expression.operand.text === "1"
    );
  });
}

function mainContentFocusability(source: string): readonly boolean[] {
  const file = sourceFileFromText("page.tsx", source);
  const visit = (node: ts.Node): readonly boolean[] => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(file) === "main" &&
      hasStringAttribute(node, "id", "main-content")
    ) {
      return [hasNegativeOneTabIndex(node)];
    }

    return node.getChildren().flatMap(visit);
  };

  return visit(file);
}

export function hasFocusableMainContentTarget(source: string): boolean {
  const targets = mainContentFocusability(source);
  return targets.length > 0 && targets.every((isFocusable) => isFocusable);
}

function hasFocusableMainContentRoute(path: string): boolean {
  return hasFocusableMainContentTarget(
    readFileSync(resolve(process.cwd(), path), "utf8"),
  );
}

describe("main-content skip-link focus contract", () => {
  it("recognizes a main target with tabIndex -1", () => {
    expect(
      hasFocusableMainContentTarget(
        '<main id="main-content" tabIndex={-1}>Content</main>',
      ),
    ).toBe(true);
  });

  it("rejects a target that would remain in the normal tab order", () => {
    expect(
      hasFocusableMainContentTarget(
        '<main id="main-content" tabIndex={0}>Content</main>',
      ),
    ).toBe(false);
  });

  it("rejects a main-content target without programmatic focusability", () => {
    expect(
      hasFocusableMainContentTarget('<main id="main-content">Content</main>'),
    ).toBe(false);
  });

  it("rejects a source when any main-content branch lacks focusability", () => {
    expect(
      hasFocusableMainContentTarget(
        '<><main id="main-content" tabIndex={-1} /><main id="main-content" /></>',
      ),
    ).toBe(false);
  });

  it.each(MAIN_CONTENT_ROUTES)(
    "$path exposes a programmatically focusable main target",
    (path) => expect(hasFocusableMainContentRoute(path)).toBe(true),
  );
});
