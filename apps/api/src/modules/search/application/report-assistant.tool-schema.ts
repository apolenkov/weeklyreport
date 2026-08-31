export const compactDefaultedSchema = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(compactDefaultedSchema);
  if (typeof value !== "object" || value === null) return value;
  const record = value as Record<string, unknown>;
  const properties =
    typeof record.properties === "object" && record.properties !== null
      ? (record.properties as Record<string, unknown>)
      : {};
  const defaulted = new Set(
    Object.entries(properties).flatMap(([key, property]) =>
      typeof property === "object" && property !== null && "default" in property
        ? [key]
        : [],
    ),
  );
  const required = Array.isArray(record.required)
    ? record.required.filter(
        (key): key is string => typeof key === "string" && !defaulted.has(key),
      )
    : undefined;
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, entry]) => {
      if (key === "$schema" || (key === "required" && required?.length === 0))
        return [];
      if (key === "required" && required) return [[key, required]];
      return [[key, compactDefaultedSchema(entry)]];
    }),
  );
};
