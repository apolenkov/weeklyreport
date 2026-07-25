/**
 * Format Timestamp.
 * @param value - The value argument.
 */
export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Truncate.
 * @param value - The value argument.
 * @param max - The max argument.
 */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

// Friendlier "Namespace: Action" label so admins need not parse camelCase.
/**
 * Humanize Procedure.
 * @param procedure - The procedure argument.
 */
export function humanizeProcedure(procedure: string): string {
  const [ns, action] = procedure.split(".");
  if (!ns || !action) return procedure;
  const titleNs = ns.charAt(0).toUpperCase() + ns.slice(1);
  const spaced = action
    .replaceAll(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
  return `${titleNs}: ${spaced}`;
}

const STATUS_LABEL: Record<string, string> = {
  success: "OK",
  failure: "Error",
  failed: "Error",
};

/**
 * Status Label.
 * @param value - The value argument.
 */
export function statusLabel(value: string): string {
  return STATUS_LABEL[value] ?? value;
}

/**
 * Copy To Clipboard.
 * @param text - The text argument.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- navigator.clipboard is undefined in non-secure contexts despite the non-null DOM type
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallthrough */
  }
  return false;
}
