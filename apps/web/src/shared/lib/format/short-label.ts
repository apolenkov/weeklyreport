const LABEL_MAX_LENGTH = 60;
const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

// Accessible names carry a short reference to the record, never its full text.
export function shortItemLabel(text: string): string {
  const flat = text.replaceAll(/\s+/g, " ").trim();
  if (flat.length <= LABEL_MAX_LENGTH) return flat;
  const firstOver = [...graphemeSegmenter.segment(flat)].find(
    ({ segment, index }) => index + segment.length > LABEL_MAX_LENGTH - 1,
  );
  return `${flat.slice(0, firstOver?.index ?? 0).trimEnd()}…`;
}
