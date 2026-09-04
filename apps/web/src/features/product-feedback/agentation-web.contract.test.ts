import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { Agentation, loadAnnotations, saveAnnotations } from "agentation";
import { describe, expect, it } from "vitest";

describe("Agentation web contract", () => {
  it("exposes the official APIs used by WeeklyReport", () => {
    expect(Agentation).toBeTypeOf("function");
    expect(loadAnnotations).toBeTypeOf("function");
    expect(saveAnnotations).toBeTypeOf("function");
  });

  it("pins the deeply reviewed release and license", () => {
    const require = createRequire(import.meta.url);
    const entrypoint = require.resolve("agentation");
    const packageJson = JSON.parse(
      readFileSync(join(dirname(entrypoint), "../package.json"), "utf8"),
    ) as { license: string; name: string; version: string };

    expect(packageJson).toMatchObject({
      license: "PolyForm-Shield-1.0.0",
      name: "agentation",
      version: "3.0.2",
    });
  });

  it("keeps the reviewed browser HTTP surface", () => {
    const require = createRequire(import.meta.url);
    const bundle = readFileSync(require.resolve("agentation"), "utf8");
    const normalizedBundle = bundle.replaceAll(
      ["$", "{"].join(""),
      "{template:",
    );
    const expectedFragments = [
      "fetch(`{template:endpoint}/sessions`, {",
      'method: "POST"',
      "fetch(`{template:endpoint}/sessions/{template:sessionId}`)",
      "fetch(`{template:endpoint}/sessions/{template:sessionId}/annotations`, {",
      "fetch(`{template:endpoint}/annotations/{template:annotationId}`, {",
      'method: "PATCH"',
      'method: "DELETE"',
      "`{template:endpoint}/sessions/{template:currentSessionId}/events`",
    ];

    for (const fragment of expectedFragments)
      expect(normalizedBundle).toContain(fragment);
  });
});
