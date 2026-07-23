import { describe, expect, it } from "vitest";

import { STATUS_BADGE } from "../../../features/report-sections/model/item-card-style";
import { workflowBadge } from "./print-report-theme";

describe("workflowBadge", () => {
  it("uses the canonical item-card labels for every supported status", () => {
    for (const status of Object.keys(
      STATUS_BADGE,
    ) as (keyof typeof STATUS_BADGE)[]) {
      expect(workflowBadge(status)).toBe(STATUS_BADGE[status].label);
    }
  });
});
