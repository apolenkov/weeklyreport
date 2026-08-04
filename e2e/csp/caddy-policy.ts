// Canonical production CSP derivation: the enforcing policy lives in
// deploy/caddy/Caddyfile, and this walk must exercise exactly that header —
// a deploy-header change without a matching test change is a drift the suite
// must catch, not a policy the test re-declares by hand.

import * as fs from "node:fs";
import * as path from "node:path";

const CADDYFILE_PATH = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "deploy",
  "caddy",
  "Caddyfile",
);

// The report-uri directive names a collector the harness has none of; the
// browser-enforced directives are what matter, so it is dropped.
export function stripReportUri(policy: string): string {
  return policy
    .split(";")
    .map((directive) => directive.trim())
    .filter(
      (directive) => directive !== "" && !directive.startsWith("report-uri"),
    )
    .join("; ");
}

export function parseCaddyCsp(caddyfile: string): string {
  const match = /Content-Security-Policy\s+"([^"]+)"/.exec(caddyfile);
  const raw = match?.[1];
  if (!raw) {
    throw new Error(
      "Caddyfile has no Content-Security-Policy header to derive the policy from",
    );
  }
  return raw;
}

export function readCaddyCsp(): string {
  return parseCaddyCsp(fs.readFileSync(CADDYFILE_PATH, "utf8"));
}
