import ts from "typescript";

export const PRODUCTION_DIST_MODES = ["--all", "--api", "--shared"] as const;

export type ProductionDistMode = (typeof PRODUCTION_DIST_MODES)[number];

export const isProductionDistMode = (
  value: string,
): value is ProductionDistMode =>
  (PRODUCTION_DIST_MODES as readonly string[]).includes(value);

export const checksApiRuntime = (mode: ProductionDistMode): boolean =>
  mode === "--all" || mode === "--api";

const INTERNAL_PACKAGES = [
  "@customreport/shared",
  "@customreport/report-persistence",
] as const;

const isInternalPackageSpecifier = (specifier: string): boolean =>
  INTERNAL_PACKAGES.some(
    (packageName) =>
      specifier === packageName || specifier.startsWith(`${packageName}/`),
  );

const literalModuleSpecifier = (node: ts.Node): string | undefined => {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier !== undefined &&
    ts.isStringLiteralLike(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier.text;
  }
  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword
  ) {
    const [argument] = node.arguments;
    return argument !== undefined && ts.isStringLiteralLike(argument)
      ? argument.text
      : undefined;
  }
  return undefined;
};

const containsInternalPackageImport = (node: ts.Node): boolean => {
  const specifier = literalModuleSpecifier(node);
  return (
    (specifier !== undefined && isInternalPackageSpecifier(specifier)) ||
    ts.forEachChild(node, (child) =>
      containsInternalPackageImport(child) ? true : undefined,
    ) === true
  );
};

export const hasBareInternalPackageImport = (source: string): boolean =>
  containsInternalPackageImport(
    ts.createSourceFile(
      "production-runtime.js",
      source,
      ts.ScriptTarget.Latest,
      false,
      ts.ScriptKind.JS,
    ),
  );
