// Shared optional Sentry DSN contract: the environment schema and the early
// Sentry bootstrap must accept and reject the same forms, so both use this
// parser. Absent or empty means "disabled" (no Sentry.init); a non-empty
// value must be a real DSN — http(s) scheme, public-key username, hostname,
// and a numeric terminal project-id path segment (self-hosted prefix paths
// and ports stay supported). A malformed non-empty value is a configuration
// error — never a silently degraded client that reports nothing.
export const SENTRY_DSN_INVALID_MESSAGE =
  "SENTRY_DSN must be a Sentry DSN (http(s)://<public-key>@<host>/<project-id>) or empty";

export const parseSentryDsn = (raw: string | undefined): string | undefined => {
  if (raw === undefined || raw === "") return undefined;
  const trimmed = raw.trim();
  if (trimmed === "") {
    // Whitespace-only is a malformed non-empty configuration, not "unset".
    throw new Error(SENTRY_DSN_INVALID_MESSAGE);
  }
  const url = URL.parse(trimmed);
  const segments = url?.pathname.split("/").filter(Boolean) ?? [];
  const projectId = segments.at(-1);
  if (
    url === null ||
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username === "" ||
    url.hostname === "" ||
    projectId === undefined ||
    !/^\d+$/u.test(projectId)
  ) {
    throw new Error(SENTRY_DSN_INVALID_MESSAGE);
  }
  return trimmed;
};
