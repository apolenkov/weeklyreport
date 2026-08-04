const UNDEFINED_KEY = "undefined";
const SPARSE_ARRAY_HOLE_KEY = "<hole>";
const KEY_COLLATOR = new Intl.Collator("en-US", {
  sensitivity: "variant",
  usage: "sort",
});

function encodePrimitive(value: unknown): string {
  if (value === undefined) return UNDEFINED_KEY;
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  throw new TypeError(`Unsupported autosave key value: ${typeof value}`);
}

export function encodeAutosaveComparisonKey(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return encodePrimitive(value);
  }
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) {
    const encodedEntries = Array.from({ length: value.length }, (_, index) =>
      Object.hasOwn(value, index)
        ? encodeAutosaveComparisonKey(value[index])
        : SPARSE_ARRAY_HOLE_KEY,
    );
    return `[${encodedEntries.join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).toSorted((left, right) =>
    KEY_COLLATOR.compare(left, right),
  );
  return `{${keys
    .map(
      (key) =>
        `${JSON.stringify(key)}:${encodeAutosaveComparisonKey(obj[key])}`,
    )
    .join(",")}}`;
}
