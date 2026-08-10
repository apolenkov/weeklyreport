import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const TEST_FUNCTIONS = new Set(["it", "test"]);
const SUITE_FUNCTIONS = new Set(["describe"]);
const ADVISORY_METHODS = new Set([
  "todo",
  "skip",
  "fixme",
  "only",
  "skipIf",
  "runIf",
]);
const FOCUSED_FUNCTIONS = new Set([
  "fit",
  "fdescribe",
  "xit",
  "xdescribe",
  "xtest",
]);

export interface CriticalTestMarker {
  readonly file: string;
  readonly line: number;
  readonly reason: string;
}

function callRootName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    return callRootName(expression.expression);
  }
  if (ts.isCallExpression(expression))
    return callRootName(expression.expression);
  return undefined;
}

function callMethods(expression: ts.Expression): readonly string[] {
  if (ts.isPropertyAccessExpression(expression)) {
    return [...callMethods(expression.expression), expression.name.text];
  }
  if (ts.isCallExpression(expression))
    return callMethods(expression.expression);
  return [];
}

function advisoryReason(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression) && FOCUSED_FUNCTIONS.has(expression.text)) {
    return `focused or disabled test function ${expression.text}`;
  }
  const root = callRootName(expression) ?? "";
  const advisory = callMethods(expression).find((method) =>
    ADVISORY_METHODS.has(method),
  );
  if (advisory && [...TEST_FUNCTIONS, ...SUITE_FUNCTIONS].includes(root))
    return `advisory test marker .${advisory}`;
  return undefined;
}

function isConditionalControlFlow(node: ts.Node): boolean {
  return (
    ts.isIfStatement(node) ||
    ts.isConditionalExpression(node) ||
    ts.isSwitchStatement(node) ||
    ts.isCaseClause(node) ||
    ts.isDefaultClause(node) ||
    ts.isCatchClause(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    (ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        node.operatorToken.kind === ts.SyntaxKind.BarBarToken))
  );
}

function isConditionalAncestor(node: ts.Node, boundary: ts.Node): boolean {
  const parent = node.parent;
  if (parent === boundary) return false;
  if (isConditionalControlFlow(parent)) return true;
  return isConditionalAncestor(parent, boundary);
}

function callbackBypass(callback: ts.FunctionLikeDeclaration): ts.Node | null {
  const body = callback.body;
  if (!body) return null;
  const find = (node: ts.Node): ts.Node | null => {
    if (node !== callback && ts.isFunctionLike(node)) return null;
    if (ts.isReturnStatement(node) && isConditionalAncestor(node, callback)) {
      return node;
    }
    return ts.forEachChild(node, find) ?? null;
  };
  return find(body);
}

function testCallback(
  call: ts.CallExpression,
): ts.FunctionLikeDeclaration | null {
  const root = callRootName(call.expression);
  if (!root || !TEST_FUNCTIONS.has(root)) return null;
  const candidate = call.arguments.at(-1);
  return candidate &&
    (ts.isArrowFunction(candidate) || ts.isFunctionExpression(candidate))
    ? candidate
    : null;
}

function markerAt(
  source: ts.SourceFile,
  fileName: string,
  node: ts.Node,
  reason: string,
): CriticalTestMarker {
  const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
  return { file: fileName, line: line + 1, reason };
}

function inspectTestCall(
  source: ts.SourceFile,
  fileName: string,
  call: ts.CallExpression,
): {
  readonly markers: readonly CriticalTestMarker[];
  readonly registrations: number;
} {
  const advisory = advisoryReason(call.expression);
  const isChainedCallee =
    ts.isCallExpression(call.parent) && call.parent.expression === call;
  const advisoryMarkers =
    advisory && !isChainedCallee
      ? [markerAt(source, fileName, call, advisory)]
      : [];
  const callback = testCallback(call);
  const conditionalMarkers =
    callback && isConditionalAncestor(call, source)
      ? [markerAt(source, fileName, call, "test registration is conditional")]
      : [];
  const bypass = callback ? callbackBypass(callback) : null;
  const bypassMarkers = bypass
    ? [
        markerAt(
          source,
          fileName,
          bypass,
          "test callback has a conditional early return",
        ),
      ]
    : [];
  return {
    markers: [...advisoryMarkers, ...conditionalMarkers, ...bypassMarkers],
    registrations: callback ? 1 : 0,
  };
}

export function findCriticalTestMarkers(
  sourceText: string,
  fileName: string,
): readonly CriticalTestMarker[] {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const markers: CriticalTestMarker[] = [];
  let executableRegistrations = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const result = inspectTestCall(source, fileName, node);
      markers.push(...result.markers);
      executableRegistrations += result.registrations;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (executableRegistrations === 0) {
    markers.push(
      markerAt(
        source,
        fileName,
        source,
        "file has no directly registered executable tests",
      ),
    );
  }
  return markers;
}

export function scanCriticalTestFiles(
  files: readonly string[],
): readonly CriticalTestMarker[] {
  return files.flatMap((file) =>
    findCriticalTestMarkers(readFileSync(file, "utf8"), file),
  );
}

function runCli(): void {
  const markers = scanCriticalTestFiles(process.argv.slice(2));
  if (markers.length === 0) return;
  markers.forEach((marker) =>
    console.error(`${marker.file}:${marker.line}: ${marker.reason}`),
  );
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) runCli();
