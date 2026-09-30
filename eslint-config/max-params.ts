import type { Rule, Scope, SourceCode } from "eslint";

type DecoratedNode = Rule.Node & {
  readonly decorators?: readonly { readonly expression: Rule.Node }[];
};

type ParameterizedNode = Rule.Node & {
  readonly params: readonly (DecoratedNode & {
    readonly typeAnnotation?: {
      readonly typeAnnotation: { readonly type: string };
    };
  })[];
};

function importDefinition(
  scope: Scope.Scope,
  identifier: Scope.Reference["identifier"],
): Extract<Scope.Definition, { type: "ImportBinding" }> | undefined {
  const reference = scope.references.find(
    (entry) => entry.identifier === identifier,
  );
  if (!reference) {
    return scope.upper ? importDefinition(scope.upper, identifier) : undefined;
  }
  const definition = reference.resolved?.defs.find(
    ({ type }) => type === "ImportBinding",
  );
  if (
    definition?.type !== "ImportBinding" ||
    definition.parent.source.value !== "@nestjs/common" ||
    ("importKind" in definition.parent &&
      definition.parent.importKind === "type") ||
    ("importKind" in definition.node && definition.node.importKind === "type")
  ) {
    return undefined;
  }
  return definition;
}

function memberName(
  property: {
    readonly type: string;
    readonly name?: string;
    readonly value?: unknown;
  },
  computed: boolean,
) {
  if (!computed && property.type === "Identifier") return property.name;
  if (
    computed &&
    property.type === "Literal" &&
    typeof property.value === "string"
  ) {
    return property.value;
  }
  return undefined;
}

function isNestMarker(
  decorator: { readonly expression: Rule.Node },
  markers: readonly string[],
  sourceCode: SourceCode,
) {
  const target =
    decorator.expression.type === "CallExpression"
      ? decorator.expression.callee
      : decorator.expression;
  if (target.type === "Identifier") {
    const definition = importDefinition(sourceCode.getScope(target), target);
    if (definition?.node.type !== "ImportSpecifier") return false;
    const imported = definition.node.imported;
    const name =
      imported.type === "Identifier" ? imported.name : imported.value;
    return typeof name === "string" && markers.includes(name);
  }
  if (
    target.type === "MemberExpression" &&
    target.object.type === "Identifier"
  ) {
    const definition = importDefinition(
      sourceCode.getScope(target.object),
      target.object,
    );
    const name = memberName(target.property, target.computed);
    return (
      definition?.node.type === "ImportNamespaceSpecifier" &&
      typeof name === "string" &&
      markers.includes(name)
    );
  }
  return false;
}

function isNestDiConstructor(node: Rule.Node, sourceCode: SourceCode) {
  if (
    node.type !== "FunctionExpression" ||
    node.parent.type !== "MethodDefinition" ||
    node.parent.kind !== "constructor"
  ) {
    return false;
  }
  const owner = node.parent.parent.parent as DecoratedNode;
  return (
    (owner.decorators ?? []).some((decorator) =>
      isNestMarker(
        decorator,
        ["Injectable", "Controller", "Catch", "Module"],
        sourceCode,
      ),
    ) ||
    node.params.some((parameter) =>
      ((parameter as DecoratedNode).decorators ?? []).some((decorator) =>
        isNestMarker(decorator, ["Inject", "Optional"], sourceCode),
      ),
    )
  );
}

export const maxParamsRule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Limit parameters except imported Nest DI constructors",
    },
    schema: [{ type: "integer", minimum: 0 }],
    defaultOptions: [4],
    messages: {
      exceed:
        "Function has too many parameters ({{count}}). Maximum allowed is {{max}}.",
    },
  },
  create(context) {
    const max = context.options[0] as number;
    function checkFunction(node: Rule.Node) {
      if (isNestDiConstructor(node, context.sourceCode)) return;
      const parameters = (node as ParameterizedNode).params;
      const first = parameters.length > 0 ? parameters[0] : undefined;
      const voidThis =
        first?.type === "Identifier" &&
        first.name === "this" &&
        first.typeAnnotation?.typeAnnotation.type === "TSVoidKeyword";
      const count = parameters.length - (voidThis ? 1 : 0);
      if (count > max) {
        context.report({ node, messageId: "exceed", data: { count, max } });
      }
    }
    return {
      FunctionDeclaration: checkFunction,
      ArrowFunctionExpression: checkFunction,
      FunctionExpression: checkFunction,
      TSDeclareFunction: checkFunction,
      TSFunctionType: checkFunction,
    };
  },
};
