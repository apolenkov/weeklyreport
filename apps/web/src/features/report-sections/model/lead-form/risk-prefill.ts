export interface RiskPrefillRequest {
  readonly signal: number;
  readonly productId: string;
  readonly stageNames: readonly string[];
  readonly severity: "at-risk" | "blocked";
  // Activity-pill raises use the activity parent instead of a product parent.
  readonly activityId?: string;
}
