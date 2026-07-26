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

// 0000000040{r}{N} -> 10 + 1 + 1 = 12
export function sectionId(
  reportSuffix: ReportSuffix,
  leadIndex: number,
): string {
  return `${UUID_PREFIX}0000000040${reportSuffix}${leadIndex}`;
}

// 000000005{r}{N}{S} -> 9 + 1 + 1 + 1 = 12
export function itemId(
  reportSuffix: ReportSuffix,
  leadIndex: number,
  itemSeq: number,
): string {
  return `${UUID_PREFIX}000000005${reportSuffix}${leadIndex}${itemSeq}`;
}

// 000000006{r}{N}{P} -> 9 + 1 + 1 + 1 = 12
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
  // "f0" marker (2) + lead(2) + prod(4) + stage(4) = 12 hex chars. Each field is
  // zero-padded so the (leadIndex, prodSeq, stageSeq) -> id mapping stays
  // injective: the old unpadded concatenation collided once a lead owned >=10
  // products (prodSeq became 2 digits), producing duplicate primary keys (P2002).
  const lead = leadIndex.toString().padStart(LEAD_FIELD_WIDTH, "0");
  const prod = prodSeq.toString().padStart(PROD_FIELD_WIDTH, "0");
  const stage = stageSeq.toString().padStart(STAGE_FIELD_WIDTH, "0");
  return `${UUID_PREFIX}f0${lead}${prod}${stage}`;
}

// 0000000009 (10) + 2-digit seq = 12
export function riskId(seq: number): string {
  return `${UUID_PREFIX}0000000009${seq.toString().padStart(RISK_SEQ_WIDTH, "0")}`;
}

// 00000000000a (12) + seq would overflow; use 00000000a (9) + 3-digit pad = 12
export function decisionId(seq: number): string {
  return `${UUID_PREFIX}00000000a${seq.toString().padStart(DECISION_SEQ_WIDTH, "0")}`;
}

// 00000000b0{P}{S} -> 10 + 1 + 1 = 12 (P is hex 0..b)
export function stageAssignmentId(prodSeq: number, stageSeq: number): string {
  return `${UUID_PREFIX}00000000b0${prodSeq.toString(HEX_RADIX)}${stageSeq}`;
}
