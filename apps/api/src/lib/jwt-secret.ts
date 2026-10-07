// Shared signing-secret predicate: the strength floor is the meaningful
// (trimmed) length, so surrounding whitespace can never raise a weak or
// placeholder value past it. The accepted secret bytes are returned to the
// signer unchanged — only this check trims.
export const MIN_JWT_SECRET_LENGTH = 32;

export const isStrongJwtSecret = (
  secret: string | undefined,
): secret is string =>
  typeof secret === "string" && secret.trim().length >= MIN_JWT_SECRET_LENGTH;
