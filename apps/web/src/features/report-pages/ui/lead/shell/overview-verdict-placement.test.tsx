import { act } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import {
  LINKED_ID,
  NEXT_TWIN_ID,
  overviewItem,
  priorSection,
  record,
  setup,
} from "./overview-verdict.test-support";

it("rechecks This week when a record arrives while the confirmation for Next week is open", async () => {
  const guardedWrite = vi.fn().mockResolvedValue(true);
  const { hook, commit, state } = setup({ nextTwin: true, guardedWrite });
  const prior = JSON.stringify(priorSection);
  let answer!: Promise<string | null>;
  act(() => {
    answer = hook.result.current.onVerdict(overviewItem, "done");
  });
  expect(hook.result.current.placement.week).toBe("next");
  commit({
    section: {
      ...state.section,
      items: [
        ...state.section.items,
        record({ id: LINKED_ID, type: "current" }),
      ],
    },
  });
  await act(async () => {
    hook.result.current.placement.choose(true);
    await Promise.resolve();
  });
  expect(hook.result.current.placement.week).toBe("current");
  await act(async () => {
    hook.result.current.placement.choose(true);
    await answer;
  });
  expect(guardedWrite).not.toHaveBeenCalled();
  expect(state.section.items).toHaveLength(2);
  expect(JSON.stringify(priorSection)).toBe(prior);
});

it.each([true, false])(
  "writes the existing Next occurrence only on acceptance (%s)",
  async (accept) => {
    const guardedWrite = vi.fn().mockResolvedValue(true);
    const { hook } = setup({ nextTwin: true, guardedWrite });
    let answer!: Promise<string | null>;
    act(() => {
      answer = hook.result.current.onVerdict(
        overviewItem,
        "paused",
        "Waiting for review",
      );
    });
    expect(hook.result.current.placement.week).toBe("next");
    await act(async () => {
      hook.result.current.placement.choose(accept);
      await answer;
    });
    if (accept)
      expect(guardedWrite.mock.calls[0]?.[0]).toMatchObject({
        patch: {
          kind: "item-patch",
          itemId: NEXT_TWIN_ID,
          patch: {
            type: "current",
            workflowStatus: "paused",
            pausedReason: "Waiting for review",
          },
        },
      });
    else expect(guardedWrite).not.toHaveBeenCalled();
  },
);
