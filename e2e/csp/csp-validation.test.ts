import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveCatalogRoute } from "../helpers/catalog-route.ts";
import { parseCaddyCsp, stripReportUri } from "./caddy-policy";

const CADDYFILE = fs.readFileSync(
  path.resolve(import.meta.dirname, "..", "..", "deploy", "caddy", "Caddyfile"),
  "utf8",
);

describe("caddy CSP derivation", () => {
  it("parses the enforcing header from the Caddyfile", () => {
    const policy = parseCaddyCsp(CADDYFILE);
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("connect-src 'self'");
  });

  it("drops report-uri but keeps every browser-enforced directive", () => {
    const stripped = stripReportUri(parseCaddyCsp(CADDYFILE));
    expect(stripped).not.toContain("report-uri");
    expect(stripped).toContain("script-src 'self' 'unsafe-inline'");
    expect(stripped).toContain(
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    );
    expect(stripped).toContain("font-src 'self' https://fonts.gstatic.com");
  });

  it("fails loud when the Caddyfile has no CSP header", () => {
    expect(() => parseCaddyCsp("header { -Server }")).toThrow(
      /no Content-Security-Policy header/,
    );
  });
});

describe("CSP route resolution", () => {
  it("resolves [reportId] for lead/head/admin to the active report", () => {
    expect(resolveCatalogRoute("/lead/report/[reportId]", "lead")).toBe(
      "/lead/report/a0000000-0000-4000-8000-000000000001",
    );
  });

  it("resolves [reportId] for viewer and /reports/ to the published report", () => {
    expect(resolveCatalogRoute("/reports/[reportId]", "viewer")).toBe(
      "/reports/a0000000-0000-4000-8000-000000000002",
    );
  });

  it("throws on any unresolved dynamic token instead of skipping the route", () => {
    expect(() =>
      resolveCatalogRoute("/lead/report/[reportId]/[sectionId]", "lead"),
    ).toThrow(/Unresolved dynamic route token/);
  });

  it("passes non-dynamic routes through unchanged", () => {
    expect(resolveCatalogRoute("/head/dashboard", "head")).toBe(
      "/head/dashboard",
    );
  });
});
