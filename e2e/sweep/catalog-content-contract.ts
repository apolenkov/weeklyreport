const ACTION_LOG_ID = "admin-actions-view";
const REQUIRED_ACTION_LOG_PHRASES = [
  "whitelisted event details",
  "displayed timestamp",
  "Search covers loaded rows only",
  "20 rows per page",
] as const;
const GROUNDING_RULE = "live source or an accepted OpenSpec change";

export function actionLogCatalogFindings(
  adminCatalog: string,
  reviewGuidance: string,
): readonly string[] {
  const findings: string[] = [];
  const catalogLines = adminCatalog.split("\n");
  const actionLogStart = catalogLines.findIndex((line) =>
    line.includes(`id: ${ACTION_LOG_ID}`),
  );
  const actionLogTail =
    actionLogStart === -1 ? [] : catalogLines.slice(actionLogStart);
  const nextIntentOffset = actionLogTail
    .slice(1)
    .findIndex((line) => line.trimStart().startsWith("- id:"));
  const actionLogBlock = (
    nextIntentOffset === -1
      ? actionLogTail
      : actionLogTail.slice(0, nextIntentOffset + 1)
  ).join("\n");

  if (actionLogStart === -1) {
    findings.push(`missing catalog intent ${ACTION_LOG_ID}`);
  }
  if (/raw payload/iu.test(actionLogBlock)) {
    findings.push(`${ACTION_LOG_ID} must not claim a raw payload`);
  }
  for (const phrase of REQUIRED_ACTION_LOG_PHRASES) {
    if (!actionLogBlock.includes(phrase)) {
      findings.push(`${ACTION_LOG_ID} must state "${phrase}"`);
    }
  }
  if (!reviewGuidance.includes(GROUNDING_RULE)) {
    findings.push(`catalog review guidance must require ${GROUNDING_RULE}`);
  }
  return findings;
}
