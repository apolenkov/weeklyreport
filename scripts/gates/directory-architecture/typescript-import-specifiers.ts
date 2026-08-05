import ts from "typescript";

const staticSpecifier = (node: ts.Node | undefined): string | undefined =>
  node !== undefined &&
  (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined;

const sourceKindFor = (file: string): ts.ScriptKind =>
  file.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : file.endsWith(".jsx")
      ? ts.ScriptKind.JSX
      : ts.ScriptKind.TS;

/** Returns every statically resolvable import-like module specifier. */
export const typescriptImportSpecifiers = (
  file: string,
  sourceText: string,
): readonly string[] => {
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    sourceKindFor(file),
  );
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    const own = [
      ts.isImportDeclaration(node)
        ? staticSpecifier(node.moduleSpecifier)
        : undefined,
      ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined
        ? staticSpecifier(node.moduleSpecifier)
        : undefined,
      ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
        ? staticSpecifier(node.argument.literal)
        : undefined,
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
        ? staticSpecifier(node.arguments[0])
        : undefined,
    ].filter((specifier): specifier is string => specifier !== undefined);
    specifiers.push(...own);
    ts.forEachChild(node, visit);
  };

  visit(source);
  return specifiers;
};
