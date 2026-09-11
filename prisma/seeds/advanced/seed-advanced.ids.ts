// Deterministic UUIDs for the advanced dataset's child rows so re-running the
// seed stays idempotent. The last UUID segment is exactly 12 hex chars
// (8-4-4-4-12), and each generator below documents how it fills those 12.

const UUID_PREFIX = "a0000000-0000-4000-8000-";
const HEX_RADIX = 16;
const LEAD_FIELD_WIDTH = 2;
const PROD_FIELD_WIDTH = 4;
const STAGE_FIELD_WIDTH = 4;
const RISK_SEQ_WIDTH = 2;
const DECISION_SEQ_WIDTH = 3;

/** Report generation slot: active, published, then the three history weeks. */
export type ReportSuffix = "1" | "2" | "3" | "4" | "5";

export const ACTIVE_SUFFIX: ReportSuffix = "1";
export const PUBLISHED_SUFFIX: ReportSuffix = "2";
export const HISTORY_SUFFIXES: readonly ReportSuffix[] = ["3", "4", "5"];

// 0000000040{r}{N}: active, published, and history suffix plus lead slot.
export function sectionId(
  reportSuffix: ReportSuffix,
  leadIndex: number,
): string {
  return `${UUID_PREFIX}0000000040${reportSuffix}${leadIndex}`;
}

// 000000005{r}{N}{S}: report suffix, lead slot, and item sequence.
export function itemId(
  reportSuffix: ReportSuffix,
  leadIndex: number,
  itemSeq: number,
): string {
  return `${UUID_PREFIX}000000005${reportSuffix}${leadIndex}${itemSeq}`;
}

// 000000006{r}{N}{P}: report suffix, lead slot, and product sequence.
export function projectStatusId(
  reportSuffix: ReportSuffix,
  leadIndex: number,
  prodSeq: number,
): string {
  return `${UUID_PREFIX}000000006${reportSuffix}${leadIndex}${prodSeq}`;
}

export function stageStatusId(
  leadIndex: number,
  prodSeq: number,
  stageSeq: number,
): string {
  // The fixture's lead, product, and stage slots fit these minimum-width segments.
  const lead = leadIndex.toString().padStart(LEAD_FIELD_WIDTH, "0");
  const prod = prodSeq.toString().padStart(PROD_FIELD_WIDTH, "0");
  const stage = stageSeq.toString().padStart(STAGE_FIELD_WIDTH, "0");
  return `${UUID_PREFIX}f0${lead}${prod}${stage}`;
}

// Risk rows use a fixed marker followed by the bounded risk sequence.
export function riskId(seq: number): string {
  return `${UUID_PREFIX}0000000009${seq.toString().padStart(RISK_SEQ_WIDTH, "0")}`;
}

// Decision rows use a distinct marker followed by the bounded decision sequence.
export function decisionId(seq: number): string {
  return `${UUID_PREFIX}00000000a${seq.toString().padStart(DECISION_SEQ_WIDTH, "0")}`;
}

// Stage assignments use a distinct marker followed by product and stage slots.
export function stageAssignmentId(prodSeq: number, stageSeq: number): string {
  return `${UUID_PREFIX}00000000b0${prodSeq.toString(HEX_RADIX)}${stageSeq}`;
}
