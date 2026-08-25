const TEXT_REPRESENTATIVE_VALUE = "Runtime sweep";

// Native controls validate the string before dispatching the input event.
const REPRESENTATIVE_FILL_VALUES: Readonly<Record<string, string | undefined>> =
  {
    text: TEXT_REPRESENTATIVE_VALUE,
    search: TEXT_REPRESENTATIVE_VALUE,
    email: "runtime-sweep@example.invalid",
    number: "1",
    date: "2026-01-01",
    time: "12:00",
    "datetime-local": "2026-01-01T12:00",
    url: "https://example.invalid",
  };

const normalizedInputTypeFor = (inputType: string | null | undefined): string =>
  (inputType ?? "").trim().toLowerCase();

export const representativeFillValueForInputType = (
  inputType: string | null | undefined,
): string =>
  REPRESENTATIVE_FILL_VALUES[normalizedInputTypeFor(inputType)] ??
  TEXT_REPRESENTATIVE_VALUE;
