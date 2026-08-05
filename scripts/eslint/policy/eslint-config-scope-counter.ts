import ts from "typescript";

export function countFileScopedConfigEntries(
  source: string,
  fileName: string,
): number {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  return sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .flatMap((declaration) =>
      declaration.initializer !== undefined &&
      ts.isArrayLiteralExpression(declaration.initializer)
        ? [...declaration.initializer.elements]
        : [],
    )
    .filter(
      (element) =>
        ts.isObjectLiteralExpression(element) &&
        element.properties.some(
          (property) =>
            ts.isPropertyAssignment(property) &&
            property.name.getText(sourceFile) === "files",
        ),
    ).length;
}
