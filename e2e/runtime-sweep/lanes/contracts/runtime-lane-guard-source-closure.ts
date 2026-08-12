import { readFile } from "node:fs/promises";

import ts from "typescript";

const ALLOWED_EXTERNAL_MODULES = new Set(["node:crypto", "zod"]);
const FORBIDDEN_GLOBAL_CALLS = new Set([
  "eval",
  "fetch",
  "Function",
  "WebSocket",
  "Worker",
]);
const FORBIDDEN_GLOBAL_IDENTIFIERS = new Set([
  "Bun",
  "Deno",
  "EventSource",
  "Function",
  "WebAssembly",
  "WebSocket",
  "Worker",
  "XMLHttpRequest",
  "eval",
  "fetch",
  "global",
  "globalThis",
  "navigator",
]);
const ALLOWED_PROCESS_PROPERTIES = new Set(["env", "exitCode"]);
const FORBIDDEN_META_PROPERTIES = new Set(["__proto__", "constructor"]);

class GuardSourceClosureError extends Error {
  override readonly name = "GuardSourceClosureError";
}

type RuntimeSpecifier = Readonly<{
  readonly module: string;
  readonly position: number;
}>;

const literalModule = (
  node: ts.Expression | ts.ModuleReference,
  sourceFile: ts.SourceFile,
): string => {
  const literal = ts.isExternalModuleReference(node) ? node.expression : node;
  if (ts.isStringLiteral(literal)) return literal.text;
  throw new GuardSourceClosureError(
    `${sourceFile.fileName}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1} has a non-literal runtime module specifier`,
  );
};

const importDeclarationSpecifier = (
  node: ts.ImportDeclaration,
): RuntimeSpecifier | undefined =>
  node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword
    ? undefined
    : {
        module: literalModule(node.moduleSpecifier, node.getSourceFile()),
        position: node.getStart(),
      };

const exportDeclarationSpecifier = (
  node: ts.ExportDeclaration,
): RuntimeSpecifier | undefined =>
  node.isTypeOnly || node.moduleSpecifier === undefined
    ? undefined
    : {
        module: literalModule(node.moduleSpecifier, node.getSourceFile()),
        position: node.getStart(),
      };

const importEqualsSpecifier = (
  node: ts.ImportEqualsDeclaration,
): RuntimeSpecifier | undefined =>
  node.isTypeOnly
    ? undefined
    : {
        module: literalModule(node.moduleReference, node.getSourceFile()),
        position: node.getStart(),
      };

const callSpecifier = (
  node: ts.CallExpression,
): RuntimeSpecifier | undefined => {
  const dynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
  const requireCall =
    ts.isIdentifier(node.expression) && node.expression.text === "require";
  if (!dynamicImport && !requireCall) return undefined;
  const [argument] = node.arguments;
  if (argument === undefined)
    throw new GuardSourceClosureError(
      `${node.getSourceFile().fileName} has an empty runtime module loader`,
    );
  return {
    module: literalModule(argument, node.getSourceFile()),
    position: node.getStart(),
  };
};

const runtimeSpecifier = (node: ts.Node): RuntimeSpecifier | undefined => {
  if (ts.isImportDeclaration(node)) return importDeclarationSpecifier(node);
  if (ts.isExportDeclaration(node)) return exportDeclarationSpecifier(node);
  if (ts.isImportEqualsDeclaration(node)) return importEqualsSpecifier(node);
  return ts.isCallExpression(node) ? callSpecifier(node) : undefined;
};

const descendantNodes = (node: ts.Node): readonly ts.Node[] => [
  node,
  ...node.getChildren().flatMap(descendantNodes),
];

const propertyCall = (
  node: ts.CallExpression,
):
  Readonly<{ readonly owner: string; readonly method: string }> | undefined => {
  if (!ts.isPropertyAccessExpression(node.expression)) return undefined;
  const { expression, name } = node.expression;
  return ts.isIdentifier(expression)
    ? { owner: expression.text, method: name.text }
    : undefined;
};

const propertyName = (
  node: ts.PropertyAccessExpression | ts.ElementAccessExpression,
): string | undefined => {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  const argument = node.argumentExpression;
  return ts.isStringLiteral(argument) ? argument.text : undefined;
};

const assertSafePropertyAccess = (
  node: ts.PropertyAccessExpression | ts.ElementAccessExpression,
): void => {
  const name = propertyName(node);
  if (name !== undefined && FORBIDDEN_META_PROPERTIES.has(name))
    throw new GuardSourceClosureError(
      `${node.getSourceFile().fileName} uses forbidden property ${name}`,
    );
};

const reviewedProcessProperty = (node: ts.Node): string | undefined => {
  const parent = node.parent;
  if (
    (ts.isAsExpression(parent) ||
      ts.isParenthesizedExpression(parent) ||
      ts.isSatisfiesExpression(parent) ||
      ts.isTypeAssertionExpression(parent) ||
      ts.isNonNullExpression(parent)) &&
    parent.expression === node
  )
    return reviewedProcessProperty(parent);
  return (ts.isPropertyAccessExpression(parent) ||
    ts.isElementAccessExpression(parent)) &&
    parent.expression === node
    ? propertyName(parent)
    : undefined;
};

const assertSafeIdentifier = (node: ts.Identifier): void => {
  if (FORBIDDEN_GLOBAL_IDENTIFIERS.has(node.text))
    throw new GuardSourceClosureError(
      `${node.getSourceFile().fileName} uses forbidden global ${node.text}`,
    );
  if (node.text === "require") {
    const directCall =
      ts.isCallExpression(node.parent) && node.parent.expression === node;
    if (!directCall)
      throw new GuardSourceClosureError(
        `${node.getSourceFile().fileName} aliases the runtime module loader`,
      );
  }
  if (node.text !== "process") return;
  const directProperty = reviewedProcessProperty(node);
  if (
    directProperty === undefined ||
    !ALLOWED_PROCESS_PROPERTIES.has(directProperty)
  )
    throw new GuardSourceClosureError(
      `${node.getSourceFile().fileName} uses unreviewed process capability`,
    );
};

const assertNoForbiddenGlobal = (
  node: ts.CallExpression | ts.NewExpression,
): void => {
  const expression = node.expression;
  if (
    ts.isIdentifier(expression) &&
    FORBIDDEN_GLOBAL_CALLS.has(expression.text)
  )
    throw new GuardSourceClosureError(
      `${node.getSourceFile().fileName} uses forbidden ${expression.text}`,
    );
  if (!ts.isCallExpression(node)) return;
  const property = propertyCall(node);
  if (property?.owner === "process")
    throw new GuardSourceClosureError(
      `${node.getSourceFile().fileName} calls unreviewed process.${property.method}`,
    );
};

const parseRuntimeSource = (
  source: string,
  fileName: string,
): Readonly<{ readonly specifiers: readonly RuntimeSpecifier[] }> => {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );
  const nodes = descendantNodes(sourceFile);
  nodes
    .filter((node): node is ts.Identifier => ts.isIdentifier(node))
    .forEach(assertSafeIdentifier);
  nodes
    .filter(
      (
        node,
      ): node is ts.PropertyAccessExpression | ts.ElementAccessExpression =>
        ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node),
    )
    .forEach(assertSafePropertyAccess);
  nodes
    .filter(
      (node): node is ts.CallExpression | ts.NewExpression =>
        ts.isCallExpression(node) || ts.isNewExpression(node),
    )
    .forEach(assertNoForbiddenGlobal);
  return {
    specifiers: nodes.flatMap((node) => {
      const specifier = runtimeSpecifier(node);
      return specifier === undefined ? [] : [specifier];
    }),
  };
};

const assertAllowedExternal = (
  specifier: RuntimeSpecifier,
  sourceUrl: URL,
): void => {
  if (ALLOWED_EXTERNAL_MODULES.has(specifier.module)) return;
  throw new GuardSourceClosureError(
    `${sourceUrl.pathname} imports unreviewed runtime module ${specifier.module}`,
  );
};

export type GuardSourceReader = (url: URL) => Promise<string>;

export const guardOnlySourceClosure = async (
  pending: readonly URL[],
  readSource: GuardSourceReader = (url) => readFile(url, "utf8"),
  sources: ReadonlyMap<string, string> = new Map(),
): Promise<ReadonlyMap<string, string>> => {
  const [current, ...remaining] = pending;
  if (current === undefined) return sources;
  if (sources.has(current.href))
    return guardOnlySourceClosure(remaining, readSource, sources);
  const source = await readSource(current);
  const { specifiers } = parseRuntimeSource(source, current.href);
  const local = specifiers.filter(({ module }) => module.startsWith("."));
  specifiers
    .filter(({ module }) => !module.startsWith("."))
    .forEach((specifier) => assertAllowedExternal(specifier, current));
  return guardOnlySourceClosure(
    [...remaining, ...local.map(({ module }) => new URL(module, current))],
    readSource,
    new Map([...sources, [current.href, source]]),
  );
};
