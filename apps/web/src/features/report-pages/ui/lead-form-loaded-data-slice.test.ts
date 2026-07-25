/**
 * @vitest-environment node
 *
 * Prop-seam guard: no `ReturnType<typeof useX>` whole-hook props under ui/.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Vitest runs with cwd = apps/web (the config root).
const UI_DIR = path.resolve(process.cwd(), "src/features/report-pages/ui");
const LEAD_FORM_LOADED_FILE = path.join(UI_DIR, "lead-form-loaded.tsx");
const HOOK_RETURN_TYPE_PATTERN = /ReturnType<\s*typeof\s+use/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__snapshots__" ? [] : sourceFiles(full);
    }
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) {
      return [];
    }
    return [full];
  });
}

const files = sourceFiles(UI_DIR).map((file) => ({
  file,
  text: readFileSync(file, "utf8"),
}));

describe("lead-form data seam guard", () => {
  it("no type under report-pages/ui references any hook's return type", () => {
    const offenders = files
      .filter(({ text }) => HOOK_RETURN_TYPE_PATTERN.test(text))
      .map(({ file }) => path.relative(UI_DIR, file));
    expect(offenders).toEqual([]);
  });

  it("LeadFormLoaded's data prop is the declared LeadFormLoadedData slice", () => {
    const text = readFileSync(LEAD_FORM_LOADED_FILE, "utf8");
    expect(text).toMatch(/readonly data:\s*LeadFormLoadedData;/);
  });
});
