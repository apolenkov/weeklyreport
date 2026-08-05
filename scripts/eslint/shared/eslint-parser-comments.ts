import tseslint from "typescript-eslint";

export interface ParsedComment {
  readonly loc: { readonly start: { readonly line: number } };
  readonly range: readonly [number, number];
  readonly value: string;
}

interface SuppressionParser {
  parseForESLint(
    code: string,
    options: Record<string, unknown>,
  ): { readonly ast: unknown };
}

const parserComment = (value: unknown): ParsedComment => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("value" in value) ||
    typeof value.value !== "string" ||
    !("range" in value) ||
    !Array.isArray(value.range) ||
    typeof value.range[0] !== "number" ||
    typeof value.range[1] !== "number" ||
    !("loc" in value) ||
    typeof value.loc !== "object" ||
    value.loc === null ||
    !("start" in value.loc) ||
    typeof value.loc.start !== "object" ||
    value.loc.start === null ||
    !("line" in value.loc.start) ||
    typeof value.loc.start.line !== "number"
  )
    throw new Error("TypeScript ESLint parser returned a malformed comment");
  return {
    value: value.value,
    range: [value.range[0], value.range[1]],
    loc: { start: { line: value.loc.start.line } },
  };
};

export const parseComments = (
  source: string,
  path: string,
): readonly ParsedComment[] => {
  const parser: SuppressionParser = tseslint.parser;
  const ast = parser.parseForESLint(source, {
    comment: true,
    ecmaVersion: "latest",
    filePath: path,
    jsx: path.endsWith(".tsx"),
    loc: true,
    range: true,
    sourceType: "module",
  }).ast;
  if (
    typeof ast !== "object" ||
    ast === null ||
    !("comments" in ast) ||
    !Array.isArray(ast.comments)
  )
    throw new Error("TypeScript ESLint parser did not return comments");
  return ast.comments.map(parserComment);
};
