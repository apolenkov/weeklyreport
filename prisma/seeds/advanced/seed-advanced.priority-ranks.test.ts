import { describe, expect, it, vi } from "vitest";

import { applyPriorityRanks } from "./seed-advanced.active-sections.js";
import { ACTIVE_SUFFIX, itemId, sectionId } from "./seed-advanced.ids.js";
import { ACTIVE_LEAD_CONFIGS } from "./seed-advanced.leads.js";

// The primary lead carries a three-entry priority list (seed-advanced.content).
const primaryConfig = ACTIVE_LEAD_CONFIGS[0];
if (!primaryConfig) throw new Error("primary lead config missing");

describe("applyPriorityRanks reconciliation", () => {
  it("clears every existing rank before applying the new set", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const update = vi.fn().mockResolvedValue({});
    const prisma = { item: { updateMany, update } } as never;

    await applyPriorityRanks(prisma, primaryConfig);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        reportSectionId: sectionId(ACTIVE_SUFFIX, primaryConfig.leadIndex),
        priorityRank: { not: null },
      },
      data: { priorityRank: null },
    });
    expect(update).toHaveBeenCalledTimes(3);
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: itemId(ACTIVE_SUFFIX, primaryConfig.leadIndex, 1) },
      data: { priorityRank: 1 },
    });
  });
});
