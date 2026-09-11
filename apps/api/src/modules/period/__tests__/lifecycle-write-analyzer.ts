import ts from "typescript";

import { payloadExpressions } from "./lifecycle-write-payloads.js";
import {
  analyzeExpression,
  isLifecycleWriteType,
} from "./lifecycle-write-provenance.js";
import {
  propertyName,
  resolvedSymbol,
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
  readonly boundArguments?: readonly ts.Expression[];
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
  seen: ReadonlySet<ts.Node> = new Set(),
): CallTarget | undefined {
  const expression = unwrap(rawExpression);
  if (seen.has(expression)) return undefined;
  const nextSeen = new Set([...seen, expression]);
  if (ts.isCallExpression(expression)) {
    return boundCallTarget(checker, expression, nextSeen);
  }
  const direct = directCallTarget(expression);
  if (direct) return direct;
  if (!ts.isIdentifier(expression)) return undefined;
  const declaration = resolvedSymbol(checker, expression)?.valueDeclaration;
  if (declaration && ts.isVariableDeclaration(declaration)) {
    return declaration.initializer
      ? callTarget(checker, declaration.initializer, nextSeen)
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

function boundCallTarget(
  checker: ts.TypeChecker,
  expression: ts.CallExpression,
  seen: ReadonlySet<ts.Node>,
): CallTarget | undefined {
  const binding = directCallTarget(unwrap(expression.expression));
  if (binding?.method !== "bind") return undefined;
  const target = callTarget(checker, binding.receiver, seen);
  return target
    ? {
        ...target,
        boundArguments: [
          ...(target.boundArguments ?? []),
          ...expression.arguments.slice(1),
        ],
      }
    : undefined;
}

function isReportDelegate(
  checker: ts.TypeChecker,
  receiver: ts.Expression,
): boolean {
  return checker
    .typeToString(checker.getTypeAtLocation(receiver))
    .includes("ReportDelegate");
}

export function analyzeLifecycleWrites(
  program: ts.Program,
  sources: readonly ts.SourceFile[],
): LifecycleViolation[] {
  const checker = program.getTypeChecker();
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

    const payloads = payloadExpressions(
      checker,
      target.boundArguments?.[0] ?? call.arguments[0],
      method,
    );
    for (const payload of payloads) {
      if (!payload) {
        addViolation(
          source,
          call,
          method,
          "<unresolved>",
          "write payload provenance is unresolved",
        );
        continue;
      }
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

  return violations;
}
