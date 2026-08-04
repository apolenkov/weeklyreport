import ts from "typescript";

export const GOVERNED_FIELDS = new Set([
  "periodState",
  "status",
  "periodStatus",
  "archived",
  "autoPublished",
  "autoArchived",
  "publishedAt",
  "publishedById",
  "reopenedAt",
]);

export function propertyName(
  node: ts.PropertyName | undefined,
): string | undefined {
  if (!node) return undefined;
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  if (ts.isComputedPropertyName(node) && ts.isStringLiteral(node.expression)) {
    return node.expression.text;
  }
  return undefined;
}

export function unwrap(expression: ts.Expression): ts.Expression {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return unwrap(expression.expression);
  }
  return expression;
}

export function resolvedSymbol(
  checker: ts.TypeChecker,
  node: ts.Node,
): ts.Symbol | undefined {
  const symbol = checker.getSymbolAtLocation(node);
  return symbol && (symbol.flags & ts.SymbolFlags.Alias) !== 0
    ? checker.getAliasedSymbol(symbol)
    : symbol;
}

export function declarationExpression(
  checker: ts.TypeChecker,
  expression: ts.Expression,
): ts.Expression | undefined {
  const symbol =
    ts.isIdentifier(expression) &&
    ts.isShorthandPropertyAssignment(expression.parent)
      ? checker.getShorthandAssignmentValueSymbol(expression.parent)
      : resolvedSymbol(checker, expression);
  const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
  if (declaration && ts.isVariableDeclaration(declaration)) {
    return declaration.initializer;
  }
  if (declaration && ts.isPropertyAssignment(declaration)) {
    return declaration.initializer;
  }
  return undefined;
}

export function symbolInitializer(
  symbol: ts.Symbol | undefined,
): ts.Expression | undefined {
  const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
  return declaration && ts.isVariableDeclaration(declaration)
    ? declaration.initializer
    : undefined;
}

export function isTransitionCall(
  checker: ts.TypeChecker,
  expression: ts.CallExpression,
): boolean {
  const symbol = resolvedSymbol(checker, expression.expression);
  return (
    symbol?.getName() === "buildTransition" &&
    symbol.declarations?.some((declaration) =>
      declaration.getSourceFile().fileName.endsWith("period-transition.ts"),
    ) === true
  );
}

function collectReturns(body: ts.Block): readonly ts.Expression[] {
  const returns: ts.Expression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isReturnStatement(node) && node.expression) {
      returns.push(node.expression);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return returns;
}

export function returnedExpressions(
  checker: ts.TypeChecker,
  call: ts.CallExpression,
): readonly ts.Expression[] {
  const symbol = resolvedSymbol(checker, call.expression);
  return (symbol?.declarations ?? []).flatMap((declaration) => {
    if (
      (ts.isFunctionDeclaration(declaration) ||
        ts.isMethodDeclaration(declaration)) &&
      declaration.body
    ) {
      return collectReturns(declaration.body);
    }
    if (
      ts.isVariableDeclaration(declaration) &&
      declaration.initializer &&
      (ts.isArrowFunction(declaration.initializer) ||
        ts.isFunctionExpression(declaration.initializer))
    ) {
      const body = declaration.initializer.body;
      return ts.isExpression(body) ? [body] : collectReturns(body);
    }
    return [];
  });
}
