import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useRecordCommentDraft } from "./record-comment-drafts";

function renderDraft() {
  const rendered = renderHook(() =>
    useRecordCommentDraft({ itemId: "item-1" }, "head-1"),
  );
  return {
    ...rendered,
    begin: () => {
      const holder: { finish: ((success: boolean) => void) | null } = {
        finish: null,
      };
      act(() => {
        holder.finish = rendered.result.current.beginSubmission();
      });
      if (!holder.finish) throw new Error("Expected a new submission");
      return holder.finish;
    },
  };
}

describe("Comment submission completion", () => {
  it("retains a newer draft when an earlier submission succeeds", () => {
    const { result, begin } = renderDraft();
    act(() => result.current.setDraft("  Comment A  "));
    const finish = begin();
    act(() => result.current.setDraft("Comment B"));
    act(() => finish(true));
    expect(result.current.draft).toBe("Comment B");
    expect(result.current.isCommentPending).toBe(false);
  });

  it("does not let an old completion release or clear a newer submission", () => {
    const { result, begin } = renderDraft();
    act(() => result.current.setDraft("Comment A"));
    const finishA = begin();
    act(() => finishA(true));
    act(() => result.current.setDraft("Comment B"));
    const finishB = begin();
    act(() => finishA(true));
    expect(result.current.draft).toBe("Comment B");
    expect(result.current.isCommentPending).toBe(true);
    act(() => finishB(false));
    expect(result.current.draft).toBe("Comment B");
    expect(result.current.isCommentPending).toBe(false);
  });
});
