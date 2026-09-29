const LABEL_MAX_LENGTH = 60;

// Accessible names carry a short reference to the record, never its full text.
export function shortItemLabel(text: string): string {
  const flat = text.replaceAll(/\s+/g, " ").trim();
  return flat.length <= LABEL_MAX_LENGTH
    ? flat
    : `${flat.slice(0, LABEL_MAX_LENGTH - 1).trimEnd()}…`;
}
