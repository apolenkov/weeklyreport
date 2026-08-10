import type { DraftSavePayload } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { seedAutosaveRefs } from "./autosave-refs";
import { makeAutosavePayload } from "./use-lead-form-autosave-harness";

function makeArgs() {
  return {
    reportSectionId: "sec-1",
    payload: makeAutosavePayload(),
    enabled: true,
    version: 1,
    onVersionChange: () => undefined,
  };
}

describe("seedAutosaveRefs — pre-bind mutation capability", () => {
  it("throws on pre-bind mutate instead of silently doing nothing", () => {
    const refs = seedAutosaveRefs(makeArgs());
    expect(() => refs.mutate({} as DraftSavePayload)).toThrow(
      /sync effect bound the live handle/,
    );
  });

  it("rejects pre-bind mutateAsync instead of resolving as a valid no-op save", async () => {
    const refs = seedAutosaveRefs(makeArgs());
    await expect(refs.mutateAsync({} as DraftSavePayload)).rejects.toThrow(
      /sync effect bound the live handle/,
    );
  });

  it("reports the pre-bind capability as not pending", () => {
    const refs = seedAutosaveRefs(makeArgs());
    expect(refs.isPending).toBe(false);
  });
});
