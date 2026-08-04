import ts from "typescript";

import {
  declarationExpression,
  GOVERNED_FIELDS,
  isTransitionCall,
  propertyName,
  returnedExpressions,
  unwrap,
} from "./lifecycle-write-symbols.js";

export interface Provenance {
  readonly unsafeFields: readonly string[];
  readonly unresolved: boolean;
  readonly transition: boolean;
}

const EMPTY_PROVENANCE: Provenance = {
  unsafeFields: [],
  unresolved: false,
  transition: false,
};

function mergeProvenance(values: readonly Provenance[]): Provenance {
  return {
    unsafeFields: [...new Set(values.flatMap((value) => value.unsafeFields))],
    unresolved: values.some((value) => value.unresolved),
    transition: values.some((value) => value.transition),
  };
}

export function isLifecycleWriteType(
  type: ts.Type,
  seen: ReadonlySet<ts.Type> = new Set(),
): boolean {
  if (seen.has(type)) return false;
  const nextSeen = new Set([...seen, type]);
  const symbol = type.aliasSymbol ?? type.getSymbol();
  const ownedAlias =
    symbol?.getName() === "LifecycleWrite" &&
    symbol.declarations?.some((declaration) =>
      declaration.getSourceFile().fileName.endsWith("period-transition.ts"),
    ) === true;
  const ownedBrand = type
    .getProperties()
    .some(
      (property) =>
        property.getName().includes("lifecycleWriteBrand") &&
        property.declarations?.some((declaration) =>
          declaration.getSourceFile().fileName.endsWith("period-transition.ts"),
        ) === true,
    );
  if (ownedAlias || ownedBrand) return true;
  return type.isUnionOrIntersection()
    ? type.types.some((member) => isLifecycleWriteType(member, nextSeen))
    : false;
}

function provenTypeProvenance(
  checker: ts.TypeChecker,
  expression: ts.Expression,
): Provenance | undefined {
  const type = checker.getTypeAtLocation(expression);
  if (isLifecycleWriteType(type)) {
    return { ...EMPTY_PROVENANCE, transition: true };
  }
  if ((type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0) {
    return undefined;
  }
  const properties = checker.getPropertiesOfType(type);
  return properties.length > 0 &&
    properties.every((property) => !GOVERNED_FIELDS.has(property.getName()))
    ? EMPTY_PROVENANCE
    : undefined;
}

export function analyzeExpression(
  checker: ts.TypeChecker,
  rawExpression: ts.Expression,
  seen: ReadonlySet<ts.Node> = new Set(),
): Provenance {
  const expression = unwrap(rawExpression);
  if (seen.has(expression)) return { ...EMPTY_PROVENANCE, unresolved: true };
  const nextSeen = new Set([...seen, expression]);

  if (ts.isObjectLiteralExpression(expression)) {
    return mergeProvenance(
      expression.properties.map((property): Provenance => {
        if (ts.isSpreadAssignment(property)) {
          return analyzeExpression(checker, property.expression, nextSeen);
        }
        const name = propertyName(property.name);
        if (name && GOVERNED_FIELDS.has(name)) {
          return { ...EMPTY_PROVENANCE, unsafeFields: [name] };
        }
        return !name && ts.isComputedPropertyName(property.name)
          ? { ...EMPTY_PROVENANCE, unresolved: true }
          : EMPTY_PROVENANCE;
      }),
    );
  }
  if (ts.isArrayLiteralExpression(expression)) {
    return mergeProvenance(
      expression.elements
        .filter(ts.isExpression)
        .map((element) => analyzeExpression(checker, element, nextSeen)),
    );
  }
  if (ts.isConditionalExpression(expression)) {
    return mergeProvenance([
      analyzeExpression(checker, expression.whenTrue, nextSeen),
      analyzeExpression(checker, expression.whenFalse, nextSeen),
    ]);
  }
  if (ts.isCallExpression(expression)) {
    if (isTransitionCall(checker, expression)) {
      return { ...EMPTY_PROVENANCE, transition: true };
    }
    const returned = returnedExpressions(checker, expression);
    return returned.length > 0
      ? mergeProvenance(
          returned.map((value) => analyzeExpression(checker, value, nextSeen)),
        )
      : { ...EMPTY_PROVENANCE, unresolved: true };
  }
  const declaration = declarationExpression(checker, expression);
  return declaration
    ? analyzeExpression(checker, declaration, nextSeen)
    : (provenTypeProvenance(checker, expression) ?? {
        ...EMPTY_PROVENANCE,
        unresolved: true,
      });
}
