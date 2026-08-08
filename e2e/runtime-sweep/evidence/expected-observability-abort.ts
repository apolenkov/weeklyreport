import type { RequestFailureRecord, ResponseRecord } from "./evidence-types.ts";

const EXPECTED_FAILURE = "net::ERR_ABORTED";
const EXPECTED_METHOD = "POST";
const EXPECTED_RESOURCE_TYPE = "fetch";
const SENTRY_PROTOCOL_VERSION = "7";
const SENTRY_BROWSER_CLIENT_PREFIXES = [
  "sentry.javascript.browser/",
  "sentry.javascript.nextjs/",
] as const;

type ObservabilityAbortRecord = Pick<
  RequestFailureRecord,
  "requestId" | "url" | "method" | "resourceType" | "failure"
>;

const expectedEnvelopeFor = (
  dsn: string | undefined,
):
  | Readonly<{ origin: string; pathname: string; publicKey: string }>
  | undefined => {
  if (dsn === undefined || dsn.trim() === "") return undefined;
  try {
    const parsed = new URL(dsn);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const projectId = segments.at(-1);
    const prefix = segments.slice(0, -1).join("/");
    const pathPrefix = prefix === "" ? "/" : `/${prefix}/`;
    const valid =
      ["http:", "https:"].includes(parsed.protocol) &&
      parsed.username !== "" &&
      projectId !== undefined &&
      /^\d+$/u.test(projectId);
    return !valid
      ? undefined
      : {
          origin: parsed.origin,
          pathname: `${pathPrefix}api/${projectId}/envelope/`,
          publicKey: parsed.username,
        };
  } catch {
    return undefined;
  }
};

const hasExactMarkers = (
  parameters: URLSearchParams,
  expectedPublicKey: string,
): boolean => {
  const version = parameters.getAll("sentry_version");
  const publicKey = parameters.getAll("sentry_key");
  const clients = parameters.getAll("sentry_client");
  return (
    version.length === 1 &&
    version[0] === SENTRY_PROTOCOL_VERSION &&
    publicKey.length === 1 &&
    publicKey[0] === expectedPublicKey &&
    clients.length === 1 &&
    clients[0] !== undefined &&
    SENTRY_BROWSER_CLIENT_PREFIXES.some((prefix) =>
      clients[0]?.startsWith(prefix),
    )
  );
};

const hasSentryEnvelopeMarkers = (
  url: string,
  dsn: string | undefined,
): boolean => {
  const expected = expectedEnvelopeFor(dsn);
  if (expected === undefined) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.origin === expected.origin &&
      parsed.pathname === expected.pathname &&
      hasExactMarkers(parsed.searchParams, expected.publicKey)
    );
  } catch {
    return false;
  }
};

const hasMatchingSuccessfulResponse = (
  record: ObservabilityAbortRecord,
  responses: readonly ResponseRecord[],
): boolean =>
  responses.filter(
    ({ method, ok, requestId, resourceType, url }) =>
      ok &&
      requestId === record.requestId &&
      method === record.method &&
      resourceType === record.resourceType &&
      url === record.url,
  ).length === 1;

export const isExpectedObservabilityAbort = (
  record: ObservabilityAbortRecord,
  responses: readonly ResponseRecord[],
  bugsinkDsn: string | undefined,
): boolean =>
  record.method === EXPECTED_METHOD &&
  record.resourceType === EXPECTED_RESOURCE_TYPE &&
  record.failure === EXPECTED_FAILURE &&
  hasSentryEnvelopeMarkers(record.url, bugsinkDsn) &&
  hasMatchingSuccessfulResponse(record, responses);
