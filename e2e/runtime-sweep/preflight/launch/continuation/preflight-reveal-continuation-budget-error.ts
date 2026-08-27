export class RevealContinuationBudgetError extends Error {
  readonly remainingMs: number;
  readonly requiredMs: number;

  constructor(input: {
    readonly remainingMs: number;
    readonly requiredMs: number;
  }) {
    super(
      `INSUFFICIENT_REMAINING_BUDGET remainingMs=${String(input.remainingMs)} requiredMs=${String(input.requiredMs)}`,
    );
    this.name = "RevealContinuationBudgetError";
    this.remainingMs = input.remainingMs;
    this.requiredMs = input.requiredMs;
  }
}
