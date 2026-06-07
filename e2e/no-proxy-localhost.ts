// Playwright's `webServer.url` health probes run in the Playwright parent
// process and use its `HTTP(S)_PROXY` env. On machines behind a corporate
// proxy (e.g. `HTTP_PROXY=http://127.0.0.1:1091`) whose `NO_PROXY` lists only
// company domains, the probe to `http://127.0.0.1:<port>/health` is routed
// through the proxy, which returns `502 Bad Gateway` for loopback targets.
// Playwright then waits the full `webServer.timeout` and fails with
// "Timed out waiting ... from config.webServer" even though the servers are
// up — a confusing failure with no server-side error.
//
// Importing this module (for side effects) before `defineConfig` guarantees
// loopback hosts bypass any proxy, so local health probes connect directly.
// Idempotent: only missing hosts are appended; existing entries are preserved.
const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "::1"];

const ensureLoopbackBypassesProxy = (): void => {
  const current = process.env.NO_PROXY ?? process.env.no_proxy ?? "";
  const entries = current
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const missing = LOOPBACK_HOSTS.filter((host) => !entries.includes(host));
  const merged = [...missing, ...entries].join(",");
  process.env.NO_PROXY = merged;
  process.env.no_proxy = merged;
};

ensureLoopbackBypassesProxy();
