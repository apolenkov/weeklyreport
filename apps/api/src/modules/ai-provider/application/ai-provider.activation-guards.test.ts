import { describe, expect, it, vi } from "vitest";

import { SemanticPreparationCoordinator } from "../../search/application/semantic-preparation.coordinator.js";
import { verifyCurrentSourceFingerprint } from "./ai-provider.activation-guards.js";

const EMPTY_SOURCE_FINGERPRINT =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("verifyCurrentSourceFingerprint", () => {
  it("preserves the real preparation coordinator receiver", async () => {
    const listSources = vi.fn().mockResolvedValue([]);
    const loadOccurrences = vi.fn().mockResolvedValue([]);
    const coordinator = new SemanticPreparationCoordinator(
      { listSources, loadOccurrences } as never,
      {} as never,
      {} as never,
      {} as never,
      1,
    );

    await expect(
      verifyCurrentSourceFingerprint(
        { preparation: coordinator } as never,
        "mistral",
        {
          semanticInputVersion: "report-assistant/v1",
          preparationSourceFingerprint: EMPTY_SOURCE_FINGERPRINT,
        } as never,
      ),
    ).resolves.toBeUndefined();
    expect(listSources).toHaveBeenCalledWith({ publishedMode: "all" });
    expect(loadOccurrences).toHaveBeenCalledWith([]);
  });
});
