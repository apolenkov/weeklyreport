import { describe, expect, it, vi } from "vitest";

import type { AutosaveRefs } from "./autosave-refs";
import { runForceSave } from "./autosave-save-runner";
import { makeAutosavePayload } from "./use-lead-form-autosave-harness";

function makeRefs(overrides: Partial<AutosaveRefs> = {}): AutosaveRefs {
  return {
    generation: Symbol("test-generation"),
    version: 1,
    lastSaved: "",
    queued: null,
    debounceTimer: null,
    payload: makeAutosavePayload(),
    sectionId: "sec-1",
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    enabled: true,
    ...overrides,
  };
}

describe("runForceSave — failure ownership", () => {
  it("resolves instead of rejecting when the underlying mutation rejects", async () => {
    const mutateAsync = vi
      .fn()
      .mockRejectedValue(
        new Error("save failed"),
      ) as unknown as AutosaveRefs["mutateAsync"];
    const refs = makeRefs({ mutateAsync });
    const setState = vi.fn();

    // The mutation's onError already surfaced the failure (toast + error
    // state → Retry); the runner must not reject on top, or `void forceSave()`
    // at the click boundary becomes an unhandled rejection.
    await expect(
      runForceSave({ getRefs: () => refs, setState }),
    ).resolves.toBeUndefined();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("does not invoke the mutation when the payload is absent", async () => {
    const refs = makeRefs({ payload: null });
    const setState = vi.fn();
    await runForceSave({ getRefs: () => refs, setState });
    expect(refs.mutateAsync).not.toHaveBeenCalled();
  });

  it("queues the payload when a save is already in flight instead of rejecting", async () => {
    const refs = makeRefs({ isPending: true });
    const setState = vi.fn();
    await runForceSave({ getRefs: () => refs, setState });
    expect(refs.mutateAsync).not.toHaveBeenCalled();
    expect(refs.queued).not.toBeNull();
  });
});
