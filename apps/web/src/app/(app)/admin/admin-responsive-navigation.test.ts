import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ROUTE_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC = path.resolve(ROUTE_DIR, "../../..");

function read(relativePath: string): string {
  return readFileSync(path.join(WEB_SRC, relativePath), "utf8");
}

describe("Admin responsive navigation contract", () => {
  it("keeps the compact picker below lg and the full strip at lg", () => {
    const pageSource = read("app/(app)/admin/page.tsx");
    const pickerSource = read("features/admin/ui/admin-tabs-mobile-select.tsx");

    expect(pickerSource).toContain("lg:hidden");
    expect(pickerSource).not.toContain("sm:hidden");
    expect(pageSource).toContain('className="hidden lg:block"');
    expect(pageSource).not.toContain('className="hidden sm:block"');
  });

  it("uses the shared focus ring for both primary presentations", () => {
    const pageSource = read("app/(app)/admin/page.tsx");
    const pickerSource = read("features/admin/ui/admin-tabs-mobile-select.tsx");

    for (const source of [pageSource, pickerSource]) {
      expect(source).toContain("focus-visible:ring-2");
      expect(source).toContain("focus-visible:ring-[var(--color-ring)]");
      expect(source).toContain("focus-visible:ring-offset-2");
    }
  });

  it("renders compact operational alerts with the route picker", () => {
    const pickerSource = read("features/admin/ui/admin-tabs-mobile-select.tsx");

    expect(pickerSource).toContain("<AdminTabsMobileAlerts />");
  });

  it("uses the canonical label registry in the wide navigation", () => {
    const pageSource = read("app/(app)/admin/page.tsx");

    expect(pageSource).toContain("ADMIN_TAB_LABELS[t]");
  });

  it("keeps the Settings selector and scrollable Radix list on complementary md sides", () => {
    const settingsSource = read("features/admin/ui/settings-tab.tsx");

    expect(settingsSource).toContain("md:hidden");
    expect(settingsSource).toMatch(/className="hidden[^\"]*md:block"/);
    expect(settingsSource).toContain("overflow-x-auto");
  });
});
