import { afterEach, describe, expect, it, vi } from "vitest";

import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import type { StatusOverviewItem } from "../../../../report-sections";
import {
  CREATED_ID,
  LINKED_ID,
  NEXT_TWIN_ID,
  overviewItem,
  PRIOR_ID,
  PRIOR_REPORT,
  priorSection,
  projects,
  record,
  setup,
  STABLE_ID,
} from "./overview-verdict.test-support";
afterEach(() => vi.useRealTimers());

describe("useOverviewVerdictActions.onVerdict", () => {
  it("continues Current before Next and preserves the explicit Next and prior snapshot", async () => {
    const before = structuredClone(priorSection);
    const { hook, state, resolve } = setup({
      linked: { carriedOver: true },
      nextTwin: true,
    });
    const nextBefore = structuredClone(
      state.section.items.find((row) => row.id === NEXT_TWIN_ID),
    );
    await expect(
      hook.result.current.onVerdict(overviewItem, "continue"),
    ).resolves.toBeNull();
    expect(
      state.section.items.find((row) => row.id === LINKED_ID)?.carriedOver,
    ).toBe(false);
    expect(state.section.items.find((row) => row.id === NEXT_TWIN_ID)).toEqual(
      nextBefore,
    );
    expect(priorSection).toEqual(before);
    expect(resolve).not.toHaveBeenCalled();
  });

  it("continues only Next in place, preserving its lineage", async () => {
    const { hook, state, resolve } = setup({ nextTwin: true });
    await expect(
      hook.result.current.onVerdict(overviewItem, "continue"),
    ).resolves.toBeNull();
    expect(state.section.items).toHaveLength(1);
    expect(state.section.items[0]).toMatchObject({
      id: NEXT_TWIN_ID,
      stableId: STABLE_ID,
      type: "current",
      text: "Ship the importer",
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("does not treat identical text in another lineage as a linked occurrence", async () => {
    const { hook, resolve } = setup({
      linked: { stableId: "80000000-0000-4000-8000-0000000000aa" },
    });
    await expect(
      hook.result.current.onVerdict(overviewItem, "continue"),
    ).resolves.toBeNull();
    expect(resolve.mock.calls[0]?.[0]).toMatchObject({
      source: { kind: "prior", recordId: PRIOR_ID },
      outcome: "continue",
    });
  });
  it("patches the linked occurrence in the draft and never calls the command", async () => {
    const before = structuredClone(priorSection);
    const { hook, apply, resolve } = setup({
      linked: { carriedOver: true, workflowStatus: "planned" },
    });

    await expect(
      hook.result.current.onVerdict(overviewItem, "done"),
    ).resolves.toBeNull();

    expect(apply).toHaveBeenCalledOnce();
    expect(apply.mock.calls[0]?.[0]).toMatchObject({
      kind: "item-patch",
      itemId: LINKED_ID,
      patch: { workflowStatus: "done", carriedOver: false },
    });
    expect(resolve).not.toHaveBeenCalled();
    // The prior week is read, never written.
    expect(priorSection).toEqual(before);
  });

  it("uses the prior-plan outcome command when the week has no occurrence", async () => {
    const { hook, apply, resolve } = setup();

    await expect(
      hook.result.current.onVerdict(overviewItem, "next"),
    ).resolves.toBeNull();

    expect(resolve).toHaveBeenCalledOnce();
    const [command, stableId] = resolve.mock.calls[0] ?? [];
    expect(command).toMatchObject({
      source: { kind: "prior", reportId: PRIOR_REPORT, recordId: PRIOR_ID },
      outcome: "plan_next",
    });
    expect(typeof command?.commandId).toBe("string");
    expect(stableId).toBe(STABLE_ID);
    expect(apply).not.toHaveBeenCalled();
  });

  it("finishes paused on the occurrence the command created", async () => {
    const { hook, apply, resolve } = setup();

    await expect(
      hook.result.current.onVerdict(overviewItem, "paused", " Waiting "),
    ).resolves.toBeNull();

    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve.mock.calls[0]?.[0]).toMatchObject({ outcome: "continue" });
    expect(apply).toHaveBeenCalledExactlyOnceWith({
      kind: "item-patch",
      itemId: CREATED_ID,
      patch: { workflowStatus: "paused", pausedReason: "Waiting" },
    });
  });

  it("reports an error, not success, when the created occurrence never reaches the draft", async () => {
    vi.useFakeTimers();
    const { hook, apply } = setup({
      // The section was not accepted: the draft keeps the old section.
      resolve: () =>
        Promise.resolve({
          stableId: STABLE_ID,
          replayed: false,
          section: makeReportSectionFixture({
            projects,
            items: [record({ id: CREATED_ID, type: "current" })],
          }),
        }),
    });

    const result = hook.result.current.onVerdict(
      overviewItem,
      "paused",
      "Waiting",
    );
    await vi.advanceTimersByTimeAsync(5000);

    await expect(result).resolves.toMatch(/pause was not applied/);
    expect(apply).not.toHaveBeenCalled();
  });

  it("reports an error, not success, when an outcome lock rejects the pause patch", async () => {
    vi.useFakeTimers();
    const { hook, apply } = setup({
      resolve: (_state, commit) => {
        const created = makeReportSectionFixture({
          projects,
          items: [record({ id: CREATED_ID, type: "current" })],
        });
        // Adopted, but the writer is still locked: the patch is dropped.
        commit({ section: created });
        apply.mockImplementation(() => undefined);
        return Promise.resolve({
          stableId: STABLE_ID,
          replayed: false,
          section: created,
        });
      },
    });

    const result = hook.result.current.onVerdict(
      overviewItem,
      "paused",
      "Waiting",
    );
    await vi.advanceTimersByTimeAsync(5000);

    await expect(result).resolves.toMatch(/pause was not applied/);
    expect(apply).toHaveBeenCalledOnce();
  });

  it("returns a message for a blank reason and writes nothing", async () => {
    const { hook, apply, resolve } = setup();

    await expect(
      hook.result.current.onVerdict(overviewItem, "paused", "  "),
    ).resolves.toMatch(/paused/);
    await expect(
      hook.result.current.onVerdict(overviewItem, "wont_do"),
    ).resolves.toMatch(/not be done/);

    expect(apply).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("does not duplicate an existing Next commitment", async () => {
    const { hook, apply, resolve } = setup({ linked: { type: "next" } });

    await expect(
      hook.result.current.onVerdict(overviewItem, "next"),
    ).resolves.toBeNull();

    expect(apply).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("never adds a second Next when a separate Next record shares the stableId", async () => {
    const { hook, apply, resolve } = setup({
      linked: { type: "current", carriedOver: true },
      nextTwin: true,
    });

    await expect(
      hook.result.current.onVerdict(overviewItem, "next"),
    ).resolves.toBeNull();

    expect(apply).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("explains why the command is blocked instead of sending it", async () => {
    const { hook, resolve } = setup({ initial: { canExecute: false } });

    await expect(
      hook.result.current.onVerdict(overviewItem, "done"),
    ).resolves.toBe("Wait for autosave to finish before changing an outcome.");

    expect(resolve).not.toHaveBeenCalled();
  });

  it("reports a failed command so the reason stays editable", async () => {
    const { hook } = setup({
      resolve: () => Promise.reject(new Error("Stale prior plan.")),
    });

    await expect(
      hook.result.current.onVerdict(overviewItem, "done"),
    ).resolves.toBe("Stale prior plan.");
  });

  it("records won't do through the command with its reason", async () => {
    const { hook, resolve } = setup({ linked: { carriedOver: true } });

    await hook.result.current.onVerdict(overviewItem, "wont_do", "Dropped");

    expect(resolve.mock.calls[0]?.[0]).toMatchObject({
      source: { kind: "current", recordId: LINKED_ID },
      outcome: "wont_do",
      reason: "Dropped",
    });
  });
});

describe("useOverviewVerdictActions autosave handoff", () => {
  it("saves the dirty draft before a command instead of refusing it", async () => {
    const { hook, resolve, saveNow } = setup({
      initial: { dirty: true, canExecute: false },
      save: (commit) => commit({ dirty: false, canExecute: true }),
    });

    await expect(
      hook.result.current.onVerdict(overviewItem, "done"),
    ).resolves.toBeNull();

    expect(saveNow).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledOnce();
  });

  it("applies Done on a linked item and at once Done on one without an occurrence", async () => {
    const { hook, apply, resolve, saveNow } = setup({
      linked: { carriedOver: true },
      save: (commit) => commit({ dirty: false, canExecute: true }),
    });
    // No occurrence of this one in the selected week: it goes by the command.
    const second = {
      ...overviewItem,
      stableId: "80000000-0000-4000-8000-0000000000aa",
    } as StatusOverviewItem;

    await expect(
      hook.result.current.onVerdict(overviewItem, "done"),
    ).resolves.toBeNull();
    await expect(
      hook.result.current.onVerdict(second, "done"),
    ).resolves.toBeNull();

    expect(apply).toHaveBeenCalledOnce();
    expect(saveNow).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledOnce();
  });

  it("shows the save failure instead of sending the command", async () => {
    const { hook, resolve } = setup({
      initial: { dirty: true, canExecute: false },
      save: (commit) => commit({ autosaveState: "error" }),
    });

    await expect(
      hook.result.current.onVerdict(overviewItem, "done"),
    ).resolves.toMatch(/autosave/);

    expect(resolve).not.toHaveBeenCalled();
  });
});

describe("useOverviewVerdictActions.onConfirmAll", () => {
  it("confirms every pending continuation in one patch", () => {
    const { hook, apply } = setup({
      linked: { carriedOver: true },
      pendingReviewCount: 1,
    });

    hook.result.current.onConfirmAll();

    expect(apply).toHaveBeenCalledExactlyOnceWith({ kind: "confirm-carried" });
    expect(hook.result.current.pendingReviewCount).toBe(1);
  });

  it("writes nothing when nothing is pending", () => {
    const { hook, apply } = setup({ linked: { carriedOver: false } });

    hook.result.current.onConfirmAll();

    expect(apply).not.toHaveBeenCalled();
  });

  it("applies right after a running command instead of dropping the click", () => {
    const { hook, apply, commit } = setup({
      linked: { carriedOver: true },
      initial: { pending: true },
    });

    hook.result.current.onConfirmAll();
    expect(apply).not.toHaveBeenCalled();

    commit({ pending: false });
    return vi.waitFor(() =>
      expect(apply).toHaveBeenCalledExactlyOnceWith({
        kind: "confirm-carried",
      }),
    );
  });
});
