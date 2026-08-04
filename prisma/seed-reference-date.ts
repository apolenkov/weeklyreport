// The single reference instant the seeds derive their periods from. Wall-clock
// `new Date()` at module load made the same seed commit produce different data
// across days and could change mid-campaign at a week boundary; an explicit
// SEED_REFERENCE_DATE (ISO 8601, UTC) pins the whole identity graph. The
// default — today — is a documented dev convenience so the active period still
// covers "today" in casual local seeding; any run that needs reproducibility
// must pass the variable explicitly.
export function seedReferenceDate(): Date {
  const raw = (process as { env: Record<string, string | undefined> }).env
    .SEED_REFERENCE_DATE;
  if (raw === undefined) {
    return new Date();
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError(
      `SEED_REFERENCE_DATE must be an ISO 8601 instant, got: ${raw}`,
    );
  }
  return parsed;
}
