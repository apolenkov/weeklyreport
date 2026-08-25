type WebServerEnvironment = Readonly<Record<string, string>>;

const OUTBOUND_PROXY_ENVIRONMENT_KEYS: ReadonlySet<string> = new Set([
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
]);

const environmentWithoutOutboundProxy = (
  environment: WebServerEnvironment | undefined,
): WebServerEnvironment =>
  Object.fromEntries(
    Object.entries(environment ?? {}).filter(
      ([key]) => !OUTBOUND_PROXY_ENVIRONMENT_KEYS.has(key),
    ),
  );

export const runtimeSweepWebEnvironment = (
  environment: WebServerEnvironment | undefined,
): WebServerEnvironment => ({
  ...environmentWithoutOutboundProxy(environment),
  // The API dev fallback reports a synthetic session without a cookie. Keep
  // the login client inert so anonymous protected routes do not redirect-loop.
  NEXT_PUBLIC_AUTH_STUB: "true",
  NEXT_PUBLIC_DISABLE_DEVTOOLS: "true",
});
