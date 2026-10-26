// F6869-4 (TASK-503.92): parseManifests must fail closed when Helm exits 0
// but its stdout carries a document that is not a Kubernetes manifest.
import { describe, expect, it } from "vitest";

import { parseManifests } from "./helm-chart-render.ts";

const DEPLOYMENT =
  "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: api\nspec: {}\n";

const CONFIG_MAP =
  "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: api-config\ndata:\n  KEY: value\n";

describe("parseManifests manifest shape", () => {
  it("keeps well-formed manifests and skips a comment-only (null) document", () => {
    const manifests = parseManifests(
      `---\n# Source: empty.yaml\n---\n${DEPLOYMENT}---\n${CONFIG_MAP}`,
    );
    expect(manifests.map((manifest) => manifest.kind)).toEqual([
      "Deployment",
      "ConfigMap",
    ]);
    expect(manifests[0]?.metadata.name).toBe("api");
    expect(manifests[1]?.metadata.name).toBe("api-config");
  });

  it.each([
    [
      "a mapping without manifest fields (warning text)",
      `WARNING: deprecated\n---\n${DEPLOYMENT}`,
    ],
    [
      "a string scalar (quoted warning text)",
      `"Warning: deprecated"\n---\n${DEPLOYMENT}`,
    ],
    ["an array document", `- a\n- b\n---\n${DEPLOYMENT}`],
    ["a number document", `42\n---\n${DEPLOYMENT}`],
  ])("rejects %s instead of accepting it as a manifest", (_name, stdout) => {
    expect(() => parseManifests(stdout)).toThrow(/manifest/i);
  });

  it.each([
    ["an object without kind", "metadata:\n  name: api\n"],
    ["an object without metadata.name", "kind: Deployment\nmetadata: {}\n"],
  ])("rejects %s", (_name, document) => {
    expect(() => parseManifests(document)).toThrow(/manifest/i);
  });
});
