/**
 * @vitest-environment node
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const SEARCH_PARAM_BOUNDARIES = [
  "src/app/(app)/head/report/[reportId]/page.tsx",
  "src/app/(app)/lead/report/[reportId]/page.tsx",
  "src/app/(app)/lead/report/page.tsx",
  "src/app/(app)/reports/[reportId]/page.tsx",
] as const;

const EXPLICIT_QUERY_STATE_ROUTES = [
  "src/app/(app)/head/report/page.tsx",
  "src/app/(app)/lead/report/[reportId]/preview/page.tsx",
] as const;

describe("App Router loading ownership", () => {
  it.each(SEARCH_PARAM_BOUNDARIES)(
    "%s retains a real search-param Suspense boundary",
    (path) => expect(source(path)).toContain("<Suspense"),
  );

  it.each(EXPLICIT_QUERY_STATE_ROUTES)(
    "%s leaves useQuery loading to its client component",
    (path) => expect(source(path)).not.toContain("<Suspense"),
  );

  it("pins the actual search-param owners behind retained boundaries", () => {
    expect(
      source("src/shared/ui/report-shell/use-report-shell-url-state.ts"),
    ).toContain("useSearchParams");
    expect(
      source("src/features/report-pages/ui/use-lead-form-data.ts"),
    ).toContain("useSearchParams");
    expect(source("src/features/viewer/ui/viewer-report-shell.tsx")).toContain(
      "useSearchParams",
    );
  });

  it("removes nested data-only Suspense from report shells", () => {
    expect(
      source("src/features/report-pages/ui/head-report-shell.tsx"),
    ).not.toContain("<Suspense");
    expect(
      source("src/features/viewer/ui/viewer-report-shell.tsx"),
    ).not.toContain("<Suspense");
  });
});
