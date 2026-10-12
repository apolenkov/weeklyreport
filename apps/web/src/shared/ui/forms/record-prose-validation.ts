import { INVISIBLE_TEXT_MESSAGE, safeText } from "@weeklyreport/shared";

export function getRequiredProseError(
  value: string,
  label: string,
  maximumLength: number,
): string | undefined {
  const result = safeText({ max: maximumLength }).safeParse(value);
  if (result.success) return undefined;
  if (value.trim().length === 0) return `${label} is required`;
  if (value.length > maximumLength) {
    return `${label} must be ${maximumLength} characters or fewer.`;
  }
  if (
    result.error.issues.some(
      (issue) => issue.message === INVISIBLE_TEXT_MESSAGE,
    )
  ) {
    return `${label} must contain visible text.`;
  }
  return `${label} contains unsupported characters.`;
}
