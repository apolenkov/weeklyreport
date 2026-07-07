// Type-narrow helper for tests.
//
// Replaces `foo!.bar` (non-null assertion, lint warning) with
// `expectDefined(foo).bar` (runtime check + type narrow). Use in
// tests where you assert that a value MUST be present and want
// an immediate, descriptive failure if it isn't.

export function expectDefined<T>(
  value: T | null | undefined,
  message?: string,
): T {
  if (value === null || value === undefined) {
    throw new Error(message ?? "expected defined value");
  }
  return value;
}
