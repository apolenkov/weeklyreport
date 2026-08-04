const PROCEDURE_PATH = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/u;
const PLACEHOLDER = /\b(?:TODO|TBD|justify|placeholder)\b/iu;
const MINIMUM_REASON_LENGTH = 20;

export function parseMutationAllowlist(raw) {
  const value = JSON.parse(raw);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Mutation allowlist must be an object");
  }
  return Object.fromEntries(
    Object.entries(value).map(([procedure, reason]) => {
      if (!PROCEDURE_PATH.test(procedure)) {
        throw new Error(`Invalid mutation allowlist procedure: ${procedure}`);
      }
      if (
        typeof reason !== "string" ||
        reason.trim().length < MINIMUM_REASON_LENGTH ||
        PLACEHOLDER.test(reason)
      ) {
        throw new Error(
          `Invalid mutation allowlist justification: ${procedure}`,
        );
      }
      return [procedure, reason];
    }),
  );
}
