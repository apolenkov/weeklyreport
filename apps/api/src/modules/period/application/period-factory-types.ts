import type { PeriodState } from "@customreport/shared";

export interface EnsuredPeriod {
  // True when this call minted the row; false when it found an existing one.
  readonly created: boolean;
  readonly reportId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  // Null only on a found (not minted) row whose deadline an admin explicitly
  // cleared; a freshly minted period always carries one.
  readonly deadline: Date | null;
  // A draft period can only be `scheduled` or `open` (the persisted
  // `status:"draft"` fields map to exactly those two states), so the public shape stays narrow.
  readonly periodState: Extract<PeriodState, "scheduled" | "open">;
}
