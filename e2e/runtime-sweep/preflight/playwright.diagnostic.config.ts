import * as path from "node:path";

import { defineConfig } from "@playwright/test";

import { assertDiagnosticOutputPath } from "./diagnostics/preflight-diagnostic-sidecar-contract.ts";
import preflightConfig from "./playwright.preflight.config.ts";

if (process.env.RUNTIME_SWEEP_PREFLIGHT_MODE !== "diagnostic")
  throw new Error(
    "Diagnostic Playwright config requires diagnostic preflight mode",
  );

const archiveRoot = path.resolve(
  process.env.RUNTIME_SWEEP_ARCHIVE ??
    (() => {
      throw new Error(
        "Diagnostic Playwright config requires RUNTIME_SWEEP_ARCHIVE",
      );
    })(),
);
const outputRootValue =
  process.env.RUNTIME_SWEEP_DIAGNOSTIC_OUTPUT_ROOT?.trim();
if (!outputRootValue)
  throw new Error(
    "Diagnostic Playwright config requires RUNTIME_SWEEP_DIAGNOSTIC_OUTPUT_ROOT",
  );
const outputRoot = path.resolve(outputRootValue);
if (!path.isAbsolute(outputRootValue) || outputRoot !== outputRootValue)
  throw new Error(
    "Diagnostic Playwright output root must be a normalized absolute path",
  );
assertDiagnosticOutputPath({ archiveRoot, outputRoot });
const relativeOutput = path.relative(archiveRoot, outputRoot);
if (
  relativeOutput === "" ||
  relativeOutput.startsWith(`..${path.sep}`) ||
  path.isAbsolute(relativeOutput)
)
  throw new Error(
    "Diagnostic Playwright output root must be below RUNTIME_SWEEP_ARCHIVE",
  );

const baseUse = preflightConfig.use ?? {};
const { recordHar: _recordHar, ...contextOptionsWithoutHar } =
  baseUse.contextOptions ?? {};
const [baseProject] = preflightConfig.projects ?? [];
if (baseProject === undefined || (preflightConfig.projects?.length ?? 0) !== 1)
  throw new Error("Diagnostic preflight requires one browser project");

const diagnosticSpec = /preflight-diagnostic\.spec\.ts/u;

export default defineConfig({
  ...preflightConfig,
  testMatch: diagnosticSpec,
  outputDir: path.join(outputRoot, "playwright"),
  reporter: [["list"]],
  retries: 0,
  use: {
    ...baseUse,
    contextOptions: contextOptionsWithoutHar,
    trace: {
      mode: "retain-on-failure",
      snapshots: false,
      screenshots: false,
      sources: true,
      attachments: true,
    },
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      ...baseProject,
      name: "runtime-preflight-diagnostic",
      testMatch: diagnosticSpec,
    },
  ],
});
