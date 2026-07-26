import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

// CI gate for period-dual-state: every Report lifecycle write must spread
// buildTransition(...); hand-assembled governed keys trip this static scan.
// See openspec/specs/period-dual-state.

const GOVERNED_FIELDS = new Set([
  "periodState",
  "status",
  "periodStatus",
  "archived",
  "autoPublished",
  "autoArchived",
]);

// Prisma write methods on the `report` delegate that take a `data`/`create`/
// `update` payload.
const WRITE_METHODS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
]);

// The only files allowed to name lifecycle fields as literal keys: the
// transition module itself (it IS the single writer). Stored as path suffixes.
const EXEMPT_SUFFIXES = [
  join("modules", "period", "domain", "period-transition.ts"),
];

// Opt-out for non-lifecycle writes (e.g. snapshot restore of divergent
// dual-state rows). Marker must sit on/above the statement and name a follow-up.
const EXEMPT_MARKER = "lifecycle-write-gate-allow";

export interface LifecycleViolation {
  file: string;
  line: number;
  field: string;
  method: string;
}

// Exported for self-tests that prove the detector fires.
export function findLifecycleViolationsInSource(
  sourceText: string,
  fileName: string,
): LifecycleViolation[] {
  const sf = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
  );
  const violations: LifecycleViolation[] = [];

  const scanDataObject = (obj: ts.ObjectLiteralExpression, method: string) => {
    for (const prop of obj.properties) {
      // Spread (`...buildTransition(...)`) carries no literal key — compliant.
      if (ts.isSpreadAssignment(prop)) continue;
      const name = prop.name;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- ts.PropertyName access is defensively guarded in AST traversal
      if (!name) continue;
      const key =
        ts.isIdentifier(name) || ts.isStringLiteral(name)
          ? name.text
          : undefined;
      if (key && GOVERNED_FIELDS.has(key)) {
        const { line } = sf.getLineAndCharacterOfPosition(prop.getStart(sf));
        violations.push({ file: fileName, line: line + 1, field: key, method });
      }
    }
  };

  const scanDataInitializer = (initializer: ts.Expression, method: string) => {
    const objects = ts.isObjectLiteralExpression(initializer)
      ? [initializer]
      : ts.isArrayLiteralExpression(initializer)
        ? initializer.elements.filter(ts.isObjectLiteralExpression)
        : [];
    objects.forEach((object) => scanDataObject(object, method));
  };

  const fullText = sf.getFullText();

  // Exempt when a leading comment on the statement (or ancestor) carries the marker.
  const isExempt = (node: ts.Node): boolean => {
    let current: ts.Node | undefined = node;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- current is reassigned to node.parent (ts.Node | undefined) inside the loop
    while (current) {
      const ranges = ts.getLeadingCommentRanges(
        fullText,
        current.getFullStart(),
      );
      if (
        ranges?.some((r) =>
          fullText.slice(r.pos, r.end).includes(EXEMPT_MARKER),
        )
      ) {
        return true;
      }
      if (ts.isStatement(current)) break;
      current = current.parent;
    }
    return false;
  };

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const method = node.expression.name.text;
      const receiver = node.expression.expression;
      // The Prisma Report delegate is either reached as `client.report` or
      // passed into a helper under the narrow `report` identifier.
      const isReportDelegate =
        (ts.isPropertyAccessExpression(receiver) &&
          receiver.name.text === "report") ||
        (ts.isIdentifier(receiver) && receiver.text === "report");
      if (isReportDelegate && WRITE_METHODS.has(method) && !isExempt(node)) {
        const arg = node.arguments[0];
        if (arg && ts.isObjectLiteralExpression(arg)) {
          for (const prop of arg.properties) {
            if (
              ts.isPropertyAssignment(prop) &&
              ts.isIdentifier(prop.name) &&
              (prop.name.text === "create" || prop.name.text === "update") &&
              ts.isObjectLiteralExpression(prop.initializer)
            ) {
              scanDataObject(prop.initializer, method);
            } else if (
              ts.isPropertyAssignment(prop) &&
              ts.isIdentifier(prop.name) &&
              prop.name.text === "data"
            ) {
              scanDataInitializer(prop.initializer, method);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sf);
  return violations;
}

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../");

function collectSourceFiles(root: string): string[] {
  const entries = readdirSync(root, { recursive: true, encoding: "utf8" });
  return entries
    .map((rel) => join(root, rel))
    .filter(
      (p) =>
        p.endsWith(".ts") &&
        !p.endsWith(".d.ts") &&
        !p.endsWith(".test.ts") &&
        !p.endsWith(".integration.test.ts") &&
        !p.endsWith(".eval.test.ts") &&
        !p.includes(join("/", "test-utils", "/")) &&
        !EXEMPT_SUFFIXES.some((suffix) => p.endsWith(suffix)),
    );
}

describe("lifecycle-write-gate", () => {
  it("no hand-assembled Report lifecycle-field writes outside the transition module", () => {
    const files = collectSourceFiles(SRC_ROOT);
    // Sanity: the walk actually found the api source tree.
    expect(files.length).toBeGreaterThan(50);

    const violations = files.flatMap((file) =>
      findLifecycleViolationsInSource(readFileSync(file, "utf8"), file),
    );

    if (violations.length > 0) {
      const report = violations
        .map(
          (v) =>
            `  ${v.file.replace(SRC_ROOT, "src")}:${v.line} — report.${v.method} writes '${v.field}' inline`,
        )
        .join("\n");
      throw new Error(
        `period-dual-state gate: ${violations.length} hand-assembled lifecycle write(s).\n` +
          `Route lifecycle fields through buildTransition(...) (spread its result into data):\n${report}`,
      );
    }

    expect(violations).toHaveLength(0);
  });

  it("self-test: the detector fires on an inline lifecycle write", () => {
    // Proves the gate is not vacuously green (mirrors the role-coverage gate's
    // mutation test). If this assertion ever fails, the detector is broken and
    // the green gate above means nothing.
    const offending = `
      async function bad(tx: any) {
        await tx.report.update({
          where: { id: "x" },
          data: { periodState: "published", autoPublished: true },
        });
      }
    `;
    const found = findLifecycleViolationsInSource(offending, "synthetic.ts");
    expect(found.map((v) => v.field).sort()).toEqual([
      "autoPublished",
      "periodState",
    ]);
  });

  it("self-test: a buildTransition spread is NOT flagged", () => {
    const compliant = `
      async function good(tx: any) {
        await tx.report.update({
          where: { id: "x" },
          data: { ...buildTransition("autoPublish", { now }), publishedSnapshot },
        });
      }
    `;
    expect(
      findLifecycleViolationsInSource(compliant, "synthetic.ts"),
    ).toHaveLength(0);
  });

  it("self-test: report.updateMany lifecycle writes are in scope", () => {
    // The guarded publish compare-and-set is a `report.updateMany`. Prove the
    // gate covers that write method: an inline lifecycle key on updateMany is
    // flagged, while a buildTransition spread (the compliant publish shape) is
    // not.
    const offending = `
      async function bad(prisma: any) {
        await prisma.report.updateMany({
          where: { id: "x", periodStatus: { not: "published" } },
          data: { periodStatus: "published", status: "published" },
        });
      }
    `;
    expect(
      findLifecycleViolationsInSource(offending, "synthetic.ts")
        .map((v) => v.field)
        .sort(),
    ).toEqual(["periodStatus", "status"]);

    const compliant = `
      async function good(prisma: any) {
        await prisma.report.updateMany({
          where: { id: "x", periodStatus: { not: "published" } },
          data: { ...buildTransition("publish", { now, userId }), publishedSnapshot },
        });
      }
    `;
    expect(
      findLifecycleViolationsInSource(compliant, "synthetic.ts"),
    ).toHaveLength(0);
  });

  it.each(["createMany", "createManyAndReturn"])(
    "self-test: report.%s array lifecycle writes are in scope",
    (method) => {
      const offending = `
      async function bad(prisma: any) {
        await prisma.report.${method}({
          data: [
            { periodState: "scheduled" },
            { status: "draft", archived: false },
          ],
        });
      }
    `;

      expect(
        findLifecycleViolationsInSource(offending, "synthetic.ts")
          .map((violation) => violation.field)
          .sort(),
      ).toEqual(["archived", "periodState", "status"]);
    },
  );

  it("self-test: a bare report delegate identifier is in scope", () => {
    const schedulerShape = `
      async function flipDueScheduledToOpen(report: any) {
        await report.updateMany({
          where: { id: "x", periodState: "scheduled" },
          data: { periodState: "open", status: "draft" },
        });
      }
    `;

    expect(
      findLifecycleViolationsInSource(schedulerShape, "synthetic.ts")
        .map((violation) => violation.field)
        .sort(),
    ).toEqual(["periodState", "status"]);
  });

  it("self-test: a call-site marker exempts the write", () => {
    const exempted = `
      async function restore(tx: any) {
        // lifecycle-write-gate-allow: snapshot restore, not a transition
        await tx.report.update({
          where: { id: "x" },
          data: { status: "published" },
        });
      }
    `;
    expect(
      findLifecycleViolationsInSource(exempted, "synthetic.ts"),
    ).toHaveLength(0);

    // ...but the SAME write without the marker is still flagged, so the
    // exemption is opt-in per call site, not a blanket off-switch.
    const unmarked = `
      async function restore(tx: any) {
        await tx.report.update({
          where: { id: "x" },
          data: { status: "published" },
        });
      }
    `;
    expect(
      findLifecycleViolationsInSource(unmarked, "synthetic.ts"),
    ).toHaveLength(1);
  });

  it("self-test: reportSection.update is out of scope", () => {
    const otherModel = `
      async function sections(tx: any) {
        await tx.reportSection.update({
          where: { id: "x" },
          data: { status: "draft" },
        });
      }
    `;
    expect(
      findLifecycleViolationsInSource(otherModel, "synthetic.ts"),
    ).toHaveLength(0);
  });
});
