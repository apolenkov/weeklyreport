import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readRoleOutputs } from "./role-outputs.ts";

const root = join(import.meta.dirname, "../../output/crawl-role-output-tests");
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("readRoleOutputs", () => {
  it("keeps usable roles and names every unusable one with its reason", () => {
    mkdirSync(root, { recursive: true });
    const out = mkdtempSync(join(root, "run-"));
    dirs.push(out);
    const lead = { role: "lead", ms: 1, runs: [] };
    writeFileSync(join(out, "role-lead.json"), JSON.stringify(lead));
    writeFileSync(join(out, "role-head.json"), '{"role":"head","ms":');
    writeFileSync(join(out, "role-admin.json"), '{"role":"admin"}');
    mkdirSync(join(out, "role-viewer.json"));

    const outputs = readRoleOutputs(out, [
      "lead",
      "head",
      "viewer",
      "admin",
      "guest",
    ]);

    expect(outputs).toEqual({
      results: [lead],
      missing: [
        { role: "head", reason: "invalid JSON" },
        { role: "viewer", reason: "unreadable (EISDIR)" },
        { role: "admin", reason: "not a role result" },
        { role: "guest", reason: "no output" },
      ],
    });
    // The truncated output is evidence and stays in place.
    expect(readFileSync(join(out, "role-head.json"), "utf8")).toBe(
      '{"role":"head","ms":',
    );
  });
});
