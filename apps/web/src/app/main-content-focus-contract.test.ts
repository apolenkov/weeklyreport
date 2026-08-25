import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import postcss from "postcss";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const MAIN_CONTENT_FOCUS_SELECTOR = "#main-content:focus";
const OUTLINE_LONGHANDS = new Set([
  "outline-color",
  "outline-style",
  "outline-width",
]);

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

export function hasMainContentFocusPresentation(source: string): boolean {
  const root = postcss.parse(source);
  let matchingSelectorRuleCount = 0;
  let validRuleCount = 0;

  root.walkRules((rule) => {
    if (rule.selector.trim() !== MAIN_CONTENT_FOCUS_SELECTOR) return;

    matchingSelectorRuleCount += 1;
    const parent = rule.parent;
    if (
      parent?.type !== "atrule" ||
      parent.name !== "layer" ||
      parent.params.trim() !== "base"
    )
      return;

    let outlineDeclarationCount = 0;
    let outlineLonghandCount = 0;
    let validOutlineDeclarationCount = 0;
    rule.walkDecls((declaration) => {
      if (declaration.prop === "outline") {
        outlineDeclarationCount += 1;
        if (declaration.value.trim() === "none" && !declaration.important) {
          validOutlineDeclarationCount += 1;
        }
      } else if (OUTLINE_LONGHANDS.has(declaration.prop)) {
        outlineLonghandCount += 1;
      }
    });

    if (
      outlineDeclarationCount === 1 &&
      validOutlineDeclarationCount === 1 &&
      outlineLonghandCount === 0
    ) {
      validRuleCount += 1;
    }
  });

  return matchingSelectorRuleCount === 1 && validRuleCount === 1;
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

describe("main-content focus presentation contract", () => {
  it("recognizes one exact landmark rule in the base layer", () => {
    expect(
      hasMainContentFocusPresentation(
        "@layer base { #main-content:focus { outline: none; } }",
      ),
    ).toBe(true);
  });

  it.each([
    ["an unrelated selector", ".card:focus { outline: none; }"],
    ["a broad main selector", "main:focus { outline: none; }"],
    ["a universal focus selector", "*:focus { outline: none; }"],
    [
      "the exact selector outside the base layer",
      "#main-content:focus { outline: none; }",
    ],
  ])("rejects %s", (_description, source) => {
    expect(hasMainContentFocusPresentation(source)).toBe(false);
  });

  it("rejects the wrong outline value", () => {
    expect(
      hasMainContentFocusPresentation(
        "@layer base { #main-content:focus { outline: auto; } }",
      ),
    ).toBe(false);
  });

  it("rejects duplicate landmark presentation owners", () => {
    expect(
      hasMainContentFocusPresentation(
        "@layer base { #main-content:focus { outline: none; } #main-content:focus { outline: none; } }",
      ),
    ).toBe(false);
  });

  it.each([
    [
      "an important declaration",
      "@layer base { #main-content:focus { outline: none !important; } }",
    ],
    [
      "an overriding outline longhand",
      "@layer base { #main-content:focus { outline: none; outline-style: solid; } }",
    ],
    [
      "a second owner outside the base layer",
      "@layer base { #main-content:focus { outline: none; } } #main-content:focus { outline: solid; }",
    ],
  ])("rejects %s", (_description, source) => {
    expect(hasMainContentFocusPresentation(source)).toBe(false);
  });

  it("requires the application stylesheet to own the landmark presentation", () => {
    expect(
      hasMainContentFocusPresentation(
        readFileSync(resolve(process.cwd(), "src/styles/app.css"), "utf8"),
      ),
    ).toBe(true);
  });
});
