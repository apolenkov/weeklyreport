export interface ConstraintViolationScope {
  readonly index?: string;
  readonly columns?: readonly string[];
}

const safeJson = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
};

const escapeRegex = (identifier: string): string =>
  identifier.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const containsIdentityToken = (
  identity: string,
  identifier: string,
): boolean => {
  const escapedIdentifier = escapeRegex(identifier);
  const pattern = `(?:^|[^A-Za-z0-9_])${escapedIdentifier}(?![A-Za-z0-9_])`;
  return new RegExp(pattern).test(identity);
};

const errorIdentity = (error: object): string => {
  const { meta, message } = error as { meta?: unknown; message?: unknown };
  return `${meta === undefined ? "" : safeJson(meta)} ${
    typeof message === "string" ? message : ""
  }`;
};

const matchesScope = (
  identity: string,
  scope: ConstraintViolationScope,
): boolean => {
  const indexMatch =
    scope.index !== undefined && containsIdentityToken(identity, scope.index);
  const columnsMatch =
    scope.columns !== undefined &&
    scope.columns.length > 0 &&
    scope.columns.every((column) => containsIdentityToken(identity, column));
  return indexMatch || columnsMatch;
};

export const isPrismaConstraintViolation = (
  error: unknown,
  code: string,
  scope?: ConstraintViolationScope,
): boolean => {
  if (typeof error !== "object" || error === null) return false;
  if ((error as { code?: unknown }).code !== code) return false;
  return scope === undefined || matchesScope(errorIdentity(error), scope);
};
