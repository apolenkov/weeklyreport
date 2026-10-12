import type { Rule } from "eslint";
import importX from "eslint-plugin-import-x";

const restrictedPathsRule = importX.rules[
  "no-restricted-paths"
] as Rule.RuleModule;

function isTypeOnly(node: unknown): boolean {
  const declaration = node as {
    readonly importKind?: string;
    readonly exportKind?: string;
    readonly specifiers?: readonly {
      readonly importKind?: string;
      readonly exportKind?: string;
    }[];
  };
  return (
    declaration.importKind === "type" ||
    declaration.exportKind === "type" ||
    (Boolean(declaration.specifiers?.length) &&
      declaration.specifiers?.every(
        (specifier) =>
          specifier.importKind === "type" || specifier.exportKind === "type",
      ) === true)
  );
}

// Reuse import-x resolution/zone semantics; only erased TS declarations bypass it.
export const webApiRuntimeRule: Rule.RuleModule = {
  meta: restrictedPathsRule.meta,
  create(context) {
    const listeners = restrictedPathsRule.create(context);
    return {
      ...listeners,
      ImportDeclaration(node) {
        if (!isTypeOnly(node)) listeners.ImportDeclaration?.(node);
      },
      ExportNamedDeclaration(node) {
        if (!isTypeOnly(node)) listeners.ExportNamedDeclaration?.(node);
      },
      ExportAllDeclaration(node) {
        if (!isTypeOnly(node)) listeners.ExportAllDeclaration?.(node);
      },
    };
  },
};
