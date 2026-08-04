import { describe, expect, it } from "vitest";

import { LEAD_SLOT_PRIMARY } from "../../prisma/seed-advanced.anchors.ts";
import {
  PUBLISHED_SUFFIX,
  sectionId as advancedSectionId,
} from "../../prisma/seed-advanced.ids.ts";
import {
  ACTIVE_REPORT_ID,
  PUBLISHED_REPORT_ID,
} from "../../prisma/seed-constants.ts";
import { publishedSectionId } from "../../prisma/seed-simple.history.ts";
import {
  buildStatePreparationPlan,
  type RuntimeStateAxes,
} from "./state-preparation.ts";

const axes: RuntimeStateAxes = {
  lifecycle: "open",
  submission: "draft",
  ownership: "single",
  permission: "allowed",
};
const request = {
  profile: "full" as const,
  axes,
  repoRoot: "/workspace/customreport",
  routeRole: "lead" as const,
  routeTarget: "active" as const,
};
const EXPECTED_DEMO_PUBLISHED_SECTION_ID =
  "a0000000-0000-4000-8000-000000000411";

describe("runtime state preparation targets", () => {
  it("targets the active report for active and non-report routes", () => {
    const active = buildStatePreparationPlan(request);
    const none = buildStatePreparationPlan({ ...request, routeTarget: "none" });

    expect(active.targets).toMatchObject({
      routeTarget: "active",
      reportId: ACTIVE_REPORT_ID,
    });
    expect(none.targets).toMatchObject({
      routeTarget: "none",
      reportId: active.targets.reportId,
      sectionId: active.targets.sectionId,
    });
  });

  it("uses deterministic published sections for each capable profile", () => {
    const demo = buildStatePreparationPlan({
      ...request,
      profile: "demo",
      routeTarget: "published",
    });
    const full = buildStatePreparationPlan({
      ...request,
      profile: "full",
      routeTarget: "published",
    });
    const stress = buildStatePreparationPlan({
      ...request,
      profile: "stress",
      routeTarget: "published",
    });

    expect(publishedSectionId(0)).toBe(EXPECTED_DEMO_PUBLISHED_SECTION_ID);
    expect(demo.targets).toMatchObject({
      routeTarget: "published",
      reportId: PUBLISHED_REPORT_ID,
      sectionId: EXPECTED_DEMO_PUBLISHED_SECTION_ID,
    });
    expect(full.targets).toMatchObject({
      routeTarget: "published",
      reportId: PUBLISHED_REPORT_ID,
      sectionId: advancedSectionId(PUBLISHED_SUFFIX, LEAD_SLOT_PRIMARY),
    });
    expect(stress.targets).toEqual(full.targets);
  });

  it("binds route target into both the target and plan digest", () => {
    const active = buildStatePreparationPlan(request);
    const published = buildStatePreparationPlan({
      ...request,
      routeTarget: "published",
    });

    expect(active.routeTarget).toBe("active");
    expect(published.routeTarget).toBe("published");
    expect(active.digest).not.toBe(published.digest);
    expect(active.targets.routeTarget).not.toBe(published.targets.routeTarget);
  });
});
