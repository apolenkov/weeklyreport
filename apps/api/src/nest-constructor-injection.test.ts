import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { Type } from "@nestjs/common";
import ts from "typescript";
import { describe, expect, it } from "vitest";

type ConstructorTarget = Type<unknown>;

interface ConstructorInventoryEntry {
  readonly file: string;
  readonly className: string;
  readonly target: ConstructorTarget;
  readonly parameterCount: number;
}

const apiSourceRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const nestPackagePrefixes = ["@nestjs/", "nestjs-"] as const;
const CONSTRUCTOR_INVENTORY_TIMEOUT_MS = 15_000;

const collectSourceFiles = (directory: string): readonly string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    if (
      !entry.isFile() ||
      !entry.name.endsWith(".ts") ||
      entry.name.endsWith(".d.ts") ||
      entry.name.includes(".test.")
    ) {
      return [];
    }
    return [entryPath];
  });

const decoratorName = (decorator: ts.Decorator): string | null => {
  const expression = decorator.expression;
  const name = ts.isCallExpression(expression)
    ? expression.expression
    : expression;
  return ts.isIdentifier(name) ? name.text : null;
};

const nestDecoratorNames = (sourceFile: ts.SourceFile): ReadonlySet<string> =>
  new Set(
    sourceFile.statements.flatMap((statement) => {
      if (!ts.isImportDeclaration(statement)) return [];
      const moduleName = ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : "";
      if (
        !nestPackagePrefixes.some((prefix) => moduleName.startsWith(prefix))
      ) {
        return [];
      }
      const namedBindings = statement.importClause?.namedBindings;
      if (!namedBindings || !ts.isNamedImports(namedBindings)) return [];
      return namedBindings.elements.map((element) => element.name.text);
    }),
  );

const constructorInventory = async (): Promise<
  readonly ConstructorInventoryEntry[]
> => {
  const entries: ConstructorInventoryEntry[] = [];
  for (const file of collectSourceFiles(apiSourceRoot)) {
    const sourceText = readFileSync(file, "utf8");
    const sourceFile = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const decorators = nestDecoratorNames(sourceFile);
    const classCandidates: ts.ClassDeclaration[] = [];
    ts.forEachChild(sourceFile, (node) => {
      if (!ts.isClassDeclaration(node) || !node.name) return;
      const classDecorators = ts
        .getDecorators(node)
        ?.map(decoratorName)
        .filter((name): name is string => name !== null);
      if (!classDecorators?.some((name) => decorators.has(name))) return;
      const constructorDeclaration = node.members.find(
        ts.isConstructorDeclaration,
      );
      if (
        !constructorDeclaration ||
        constructorDeclaration.parameters.length === 0
      ) {
        return;
      }
      classCandidates.push(node);
    });
    if (classCandidates.length === 0) continue;
    const loadedModule = (await import(pathToFileURL(file).href)) as Readonly<
      Record<string, unknown>
    >;
    for (const node of classCandidates) {
      const constructorDeclaration = node.members.find(
        ts.isConstructorDeclaration,
      );
      if (!constructorDeclaration) continue;
      const target = loadedModule[node.name?.text ?? ""] as
        ConstructorTarget | undefined;
      if (!target) {
        throw new Error(
          `Nest class ${node.name?.text ?? "<anonymous>"} is not exported from ${relative(process.cwd(), file)}`,
        );
      }
      entries.push({
        file,
        className: node.name?.text ?? "<anonymous>",
        target,
        parameterCount: constructorDeclaration.parameters.length,
      });
    }
  }
  return entries;
};

describe("Nest constructor injection", () => {
  it(
    "declares an explicit token for every decorated constructor parameter",
    async () => {
      const entries = await constructorInventory();
      const missing = entries.flatMap((entry) => {
        const metadata = Reflect.getMetadata(
          "self:paramtypes",
          entry.target,
        ) as
          | readonly { readonly index: number; readonly param: unknown }[]
          | undefined;
        const explicitIndexes = new Set(
          metadata?.map((item) => item.index) ?? [],
        );
        return Array.from({ length: entry.parameterCount }, (_, index) =>
          explicitIndexes.has(index)
            ? []
            : [
                `${relative(process.cwd(), entry.file)}:${entry.className}[${index}]`,
              ],
        ).flat();
      });

      expect(missing).toEqual([]);
    },
    CONSTRUCTOR_INVENTORY_TIMEOUT_MS,
  );
});
