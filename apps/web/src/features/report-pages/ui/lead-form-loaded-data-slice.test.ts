/**
 * @vitest-environment node
 *
 * Prop-seam guard. The companion ban on `ReturnType<typeof useX>` types under
 * this directory is enforced by no-restricted-syntax in eslint.config.ts.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Vitest runs with cwd = apps/web (the config root).
const LEAD_FORM_LOADED_FILE = path.resolve(
  process.cwd(),
  "src/features/report-pages/ui/lead-form-loaded.tsx",
);

describe("lead-form data seam guard", () => {
  it("LeadFormLoaded's data prop is the declared LeadFormLoadedData slice", () => {
    const text = readFileSync(LEAD_FORM_LOADED_FILE, "utf8");
    expect(text).toMatch(/readonly data:\s*LeadFormLoadedData;/);
  });
});
