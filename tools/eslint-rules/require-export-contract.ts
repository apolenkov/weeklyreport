import type { Rule } from "eslint";

type ExportSpecifierNode = Rule.Node & {
  readonly local: Rule.Node & { readonly name: string };
};

type ExportNamedDeclarationNode = Rule.Node & {
  readonly declaration: Rule.Node | null;
  readonly source: Rule.Node | null;
  readonly specifiers: readonly ExportSpecifierNode[];
};

const declarationOwner = (node: Rule.Node): Rule.Node =>
  node.type === "VariableDeclarator" ? node.parent : node;

export const requireExportContract: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a JSDoc contract on declarations exposed through local export lists",
    },
    schema: [],
    messages: {
      missing:
        "Public export '{{name}}' needs a concise JSDoc contract on its declaration.",
    },
  },
  create(context) {
    const checkExport = (rawNode: Rule.Node): void => {
      const node = rawNode as ExportNamedDeclarationNode;
      if (node.source !== null || node.declaration !== null) return;
      const scope = context.sourceCode.getScope(node);
      for (const specifier of node.specifiers) {
        const name = specifier.local.name;
        const variable = scope.variables.find(
          (candidate) => candidate.name === name,
        );
        const definition = variable?.defs[0];
        if (definition === undefined) continue;
        if (definition.type === "ImportBinding") continue;
        const owner = declarationOwner(definition.node as unknown as Rule.Node);
        const comments = context.sourceCode.getCommentsBefore(owner);
        const contract = comments.at(-1);
        if (contract?.type === "Block" && contract.value.startsWith("*")) {
          continue;
        }
        context.report({
          node: specifier,
          messageId: "missing",
          data: { name },
        });
      }
    };

    return { ExportNamedDeclaration: checkExport };
  },
};
