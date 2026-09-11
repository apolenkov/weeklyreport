import ts from "typescript";

import {
  declarationExpression,
  propertyName,
  symbolInitializer,
  unwrap,
} from "./lifecycle-write-symbols.js";

type PayloadMap = ReadonlyMap<string, ts.Expression | undefined>;

function unresolvedPayloads(keys: readonly string[]): PayloadMap {
  return new Map(keys.map((key) => [key, undefined]));
}

function propertyPayloads(
  checker: ts.TypeChecker,
  property: ts.ObjectLiteralElementLike,
  keys: readonly string[],
  seen: ReadonlySet<ts.Node>,
): PayloadMap {
  if (ts.isSpreadAssignment(property)) {
    return resolvePayloads(checker, property.expression, keys, seen);
  }
  const name = propertyName(property.name);
  if (!name) return unresolvedPayloads(keys);
  if (!keys.includes(name)) return new Map();
  if (ts.isShorthandPropertyAssignment(property)) {
    const value = symbolInitializer(
      checker.getShorthandAssignmentValueSymbol(property),
    );
    return new Map([[name, value ?? property.name]]);
  }
  return new Map([
    [
      name,
      ts.isPropertyAssignment(property) ? property.initializer : undefined,
    ],
  ]);
}

function resolvePayloads(
  checker: ts.TypeChecker,
  rawExpression: ts.Expression,
  keys: readonly string[],
  seen: ReadonlySet<ts.Node>,
): PayloadMap {
  const expression = unwrap(rawExpression);
  if (seen.has(expression)) return unresolvedPayloads(keys);
  const nextSeen = new Set([...seen, expression]);
  if (!ts.isObjectLiteralExpression(expression)) {
    const declaration = declarationExpression(checker, expression);
    return declaration
      ? resolvePayloads(checker, declaration, keys, nextSeen)
      : unresolvedPayloads(keys);
  }
  const payloads = new Map<string, ts.Expression | undefined>();
  for (const property of expression.properties) {
    // Root spreads and explicit properties use JavaScript's last-write order.
    for (const [name, value] of propertyPayloads(
      checker,
      property,
      keys,
      nextSeen,
    )) {
      payloads.set(name, value);
    }
  }
  return payloads;
}

export function payloadExpressions(
  checker: ts.TypeChecker,
  argument: ts.Expression | undefined,
  method: string,
): readonly (ts.Expression | undefined)[] {
  if (!argument) return [undefined];
  const keys = method === "upsert" ? ["create", "update"] : ["data"];
  const payloads = resolvePayloads(checker, argument, keys, new Set());
  return keys.map((key) => payloads.get(key));
}
