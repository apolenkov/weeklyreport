import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../lib/logger";
import { NoopIngestionQueue } from "./publication.service";

describe("NoopIngestionQueue — never silent, never production-wired", () => {
  it("refuses production composition (fail loud instead of silent wiring)", () => {
    expect(
      () => new NoopIngestionQueue(createNullLogger(), "production"),
    ).toThrow(/real ingestion consumer is required in production/);
  });

  it("logs a loud warning on every enqueue in dev (trace, never silent)", async () => {
    const warn = vi.fn();
    const logger = {
      debug: () => undefined,
      info: () => undefined,
      warn,
      error: () => undefined,
      child: () => logger,
    };
    const queue = new NoopIngestionQueue(logger, "development");

    await queue.enqueue(["s1", "s2"]);

    expect(warn).toHaveBeenCalledWith(
      "ingestion is a no-op: no queue consumer wired; publication-time ingestion skipped",
      expect.objectContaining({ sectionIds: 2 }),
    );
  });
});
