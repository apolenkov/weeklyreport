/**
 * @vitest-environment node
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const trendsSource = readFileSync(
  resolve(process.cwd(), "src/app/(app)/reports/trends/page.tsx"),
  "utf8",
);

describe("Trends chunk loading", () => {
  it.each([
    "features/analytics/ui/traffic-light-history.chart",
    "features/analytics/ui/lead-velocity.chart",
    "features/analytics/ui/period-comparison.chart",
  ])("loads %s through its concrete module", (modulePath) => {
    expect(trendsSource).toContain(`\"../../../../${modulePath}\"`);
  });

  it("keeps client-only chart loading and local skeleton fallbacks", () => {
    expect(trendsSource.match(/ssr: false/g)).toHaveLength(3);
    expect(
      trendsSource.match(/loading: \(\) => <ChartSkeleton \/>/g),
    ).toHaveLength(3);
    expect(trendsSource).not.toContain(
      'import("../../../../features/analytics")',
    );
  });
});
