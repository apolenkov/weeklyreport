import { readFile } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

describe("diagnostic preflight boundary", () => {
  it("keeps the child outside acceptance writers and normal evidence outputs", async () => {
    const [spec, cli, config, launcher, selection] = await Promise.all([
      readFile(
        path.resolve(import.meta.dirname, "..", "preflight-diagnostic.spec.ts"),
        "utf8",
      ),
      readFile(
        path.resolve(
          import.meta.dirname,
          "..",
          "run-runtime-preflight-diagnostic.ts",
        ),
        "utf8",
      ),
      readFile(
        path.resolve(
          import.meta.dirname,
          "..",
          "playwright.diagnostic.config.ts",
        ),
        "utf8",
      ),
      readFile(
        path.resolve(
          import.meta.dirname,
          "..",
          "launch",
          "preflight-diagnostic-playwright-child.ts",
        ),
        "utf8",
      ),
      readFile(
        path.resolve(
          import.meta.dirname,
          "..",
          "canary",
          "preflight-canary-selection.ts",
        ),
        "utf8",
      ),
    ]);
    expect(spec).toContain("runPlaywrightPreflightSegment");
    expect(spec).toContain("createDiagnosticSidecar");
    expect(spec).not.toMatch(
      /preflight-journal|createPreflightCanaryPass|matrix-finalizer|PREFLIGHT_CANARY\.json|PREFLIGHT\.json|PREFLIGHT_ASSIGNMENT\.json|PREFLIGHT\.journal\.jsonl|PREFLIGHT_SEGMENT\.json|from "\.\/canary\/preflight-canary\.ts"/u,
    );
    expect(cli).not.toMatch(
      /preflight-journal|createPreflightCanaryPass|matrix-finalizer|PREFLIGHT_CANARY\.json|PREFLIGHT\.json|PREFLIGHT_ASSIGNMENT\.json|PREFLIGHT\.journal\.jsonl|PREFLIGHT_SEGMENT\.json|from "\.\/canary\/preflight-canary\.ts"/u,
    );
    expect(cli).toContain("assertDiagnosticCampaignBinding");
    expect(cli).toContain("assertDiagnosticOutputPath");
    expect(config).toContain("assertDiagnosticOutputPath");
    expect(selection).not.toMatch(/from "\.\/preflight-canary\.ts"/u);
    expect(config).toContain('mode: "retain-on-failure"');
    expect(config).toContain('screenshot: "only-on-failure"');
    expect(config).toContain('video: "retain-on-failure"');
    expect(config).toContain('content: "omit"');
    expect(config).toContain('mode: "full"');
    expect(cli).toContain("assertDiagnosticFailureArtifacts");
    expect(launcher).toContain("playwright.diagnostic.config.ts");
    expect(launcher).not.toContain("playwright.preflight.config.ts");
  });
});
