import ts from "typescript";

import {
  analyzeExpression,
  isLifecycleWriteType,
} from "./lifecycle-write-provenance.js";
import {
  declarationExpression,
  propertyName,
  resolvedSymbol,
  symbolInitializer,
  unwrap,
} from "./lifecycle-write-symbols.js";

const WRITE_METHODS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
]);
const PAYLOAD_KEYS = new Set(["data", "create", "update"]);
const EXEMPT_MARKER = "lifecycle-write-gate-allow";
const EXACT_EXEMPT_MARKER =
  /lifecycle-write-gate-allow\(ref=([A-Z][A-Z0-9-]*)\)/g;

export interface LifecycleExemption {
  readonly ref: string;
  readonly ownerSuffix: string;
}

export interface LifecycleViolation {
  readonly file: string;
  readonly line: number;
  readonly field: string;
  readonly method: string;
  readonly reason: string;
}

interface CallTarget {
  readonly method: string | undefined;
  readonly receiver: ts.Expression;
}

function directCallTarget(expression: ts.Expression): CallTarget | undefined {
  if (
    ts.isElementAccessExpression(expression) &&
    ts.isStringLiteral(expression.argumentExpression)
  ) {
    return {
      method: expression.argumentExpression.text,
      receiver: expression.expression,
    };
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return { method: expression.name.text, receiver: expression.expression };
  }
  if (ts.isElementAccessExpression(expression)) {
    return { method: undefined, receiver: expression.expression };
  }
  return undefined;
}

function callTarget(
  checker: ts.TypeChecker,
  rawExpression: ts.Expression,
): CallTarget | undefined {
  const expression = unwrap(rawExpression);
  const direct = directCallTarget(expression);
  if (direct) return direct;
  if (!ts.isIdentifier(expression)) return undefined;
  const declaration = resolvedSymbol(checker, expression)?.valueDeclaration;
  if (declaration && ts.isVariableDeclaration(declaration)) {
    return declaration.initializer
      ? callTarget(checker, declaration.initializer)
      : undefined;
  }
  if (
    declaration &&
    ts.isBindingElement(declaration) &&
    ts.isObjectBindingPattern(declaration.parent)
  ) {
    const variable = declaration.parent.parent;
    const bindingName =
      declaration.propertyName ??
      (ts.isIdentifier(declaration.name) ? declaration.name : undefined);
    const method = propertyName(bindingName);
    return ts.isVariableDeclaration(variable) && variable.initializer
      ? { method, receiver: variable.initializer }
      : undefined;
  }
  return undefined;
}

function isReportDelegate(
  checker: ts.TypeChecker,
  receiver: ts.Expression,
): boolean {
  return checker
    .typeToString(checker.getTypeAtLocation(receiver))
    .includes("ReportDelegate");
}

function payloadExpressions(
  checker: ts.TypeChecker,
  argument: ts.Expression | undefined,
): readonly ts.Expression[] | undefined {
  if (!argument) return undefined;
  const expression = unwrap(argument);
  const resolved = ts.isObjectLiteralExpression(expression)
    ? expression
    : declarationExpression(checker, expression);
  if (!resolved) return undefined;
  const object = unwrap(resolved);
  if (!ts.isObjectLiteralExpression(object)) return undefined;
  return object.properties.flatMap((property) => {
    if (ts.isShorthandPropertyAssignment(property)) {
      if (!PAYLOAD_KEYS.has(property.name.text)) return [];
      const value = symbolInitializer(
        checker.getShorthandAssignmentValueSymbol(property),
      );
      return [value ?? property.name];
    }
    if (!ts.isPropertyAssignment(property)) return [];
    const name = propertyName(property.name);
    return name && PAYLOAD_KEYS.has(name) ? [property.initializer] : [];
  });
}

function markerForNode(source: ts.SourceFile, node: ts.Node): string | null {
  const text = source.getFullText();
  const statement = ts.findAncestor(node, ts.isStatement) ?? node;
  const comments = ts
    .getLeadingCommentRanges(text, statement.getFullStart())
    ?.map((range) => text.slice(range.pos, range.end))
    .join("\n");
  return comments?.includes(EXEMPT_MARKER) ? comments : null;
}

function exemptionRef(marker: string): string | undefined {
  const matches = [...marker.matchAll(EXACT_EXEMPT_MARKER)];
  return matches.length === 1 ? matches[0]?.[1] : undefined;
}

export function analyzeLifecycleWrites(
  program: ts.Program,
  sources: readonly ts.SourceFile[],
  exemptions: readonly LifecycleExemption[] = [],
): LifecycleViolation[] {
  const checker = program.getTypeChecker();
  const usedExemptions = new Set<string>();
  const violations: LifecycleViolation[] = [];

  const addViolation = (
    source: ts.SourceFile,
    node: ts.Node,
    method: string,
    field: string,
    reason: string,
  ) => {
    const { line } = source.getLineAndCharacterOfPosition(
      node.getStart(source),
    );
    violations.push({
      file: source.fileName,
      line: line + 1,
      field,
      method,
      reason,
    });
  };

  const scanCall = (source: ts.SourceFile, call: ts.CallExpression): void => {
    const target = callTarget(checker, call.expression);
    if (!target || !isReportDelegate(checker, target.receiver)) return;
    if (!target.method) {
      addViolation(
        source,
        call,
        "<unresolved>",
        "<unresolved>",
        "report write method is unresolved",
      );
      return;
    }
    const method = target.method;
    if (!WRITE_METHODS.has(method)) return;

    const marker = markerForNode(source, call);
    if (marker) {
      const ref = exemptionRef(marker);
      const exemption = exemptions.find((candidate) => candidate.ref === ref);
      if (!ref || !exemption) {
        addViolation(
          source,
          call,
          method,
          "<exemption>",
          "malformed or unknown exemption",
        );
        return;
      }
      if (!source.fileName.endsWith(exemption.ownerSuffix)) {
        addViolation(
          source,
          call,
          method,
          "<exemption>",
          "exemption outside its owner",
        );
        return;
      }
      usedExemptions.add(ref);
      return;
    }

    const payloads = payloadExpressions(checker, call.arguments[0]);
    if (!payloads || payloads.length === 0) {
      addViolation(
        source,
        call,
        method,
        "<unresolved>",
        "write payload provenance is unresolved",
      );
      return;
    }
    for (const payload of payloads) {
      const provenance = analyzeExpression(checker, payload);
      provenance.unsafeFields.forEach((field) =>
        addViolation(
          source,
          payload,
          method,
          field,
          "governed field bypasses buildTransition",
        ),
      );
      if (provenance.unresolved) {
        addViolation(
          source,
          payload,
          method,
          "<unresolved>",
          "write data provenance is unresolved",
        );
      }
    }
  };

  for (const source of sources) {
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) scanCall(source, node);
      if (
        (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) &&
        isLifecycleWriteType(checker.getTypeAtLocation(node)) &&
        !source.fileName.endsWith("period-transition.ts")
      ) {
        addViolation(
          source,
          node,
          "assertion",
          "<forged-transition>",
          "LifecycleWrite must be produced by buildTransition",
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  exemptions
    .filter((exemption) => !usedExemptions.has(exemption.ref))
    .forEach((exemption) =>
      violations.push({
        file: exemption.ownerSuffix,
        line: 1,
        field: "<exemption>",
        method: "none",
        reason: `unreferenced exemption ${exemption.ref}`,
      }),
    );
  return violations;
}
