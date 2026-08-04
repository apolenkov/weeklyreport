/** Advisory product-count ceiling used only for slide-capacity warnings. */
export const MAX_PRODUCTS_PER_LEAD = 6;

/**
 * CorrelationId prefix of audit rows written by the manual-UAT driver. These
 * rows must never surface in the admin Action Log, so both the API repository
 * query and the UI treat them as internal.
 */
export const ACTION_LOG_PROOF_CORRELATION_PREFIX = "manual-action-log-proof";
