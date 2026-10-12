// Pure JSON helpers of the read-through cache: neither may turn a compute into a failure.

// A cache hit is only trusted when the parsed value passes the optional type
// predicate. Parsing and validation are separate failure modes: a validator
// that throws is a validation failure, never a parse failure.
export type ParseOutcome =
  { readonly ok: true; readonly value: unknown } | { readonly ok: false };

export function parseJson(cached: string): ParseOutcome {
  try {
    return { ok: true, value: JSON.parse(cached) as unknown };
  } catch {
    return { ok: false };
  }
}

export type Serialized =
  { readonly ok: true; readonly value: string } | { readonly ok: false };

// JSON.stringify throws on BigInt, circular structures and a throwing toJSON, and
// returns undefined for functions and symbols. A cache write must never turn a
// successful compute into a rejected call, so every one of those outcomes is a
// plain "not cacheable" here.
export function serializeForCache(value: unknown): Serialized {
  try {
    const serialized: unknown = JSON.stringify(value);
    return typeof serialized === "string"
      ? { ok: true, value: serialized }
      : { ok: false };
  } catch {
    return { ok: false };
  }
}
