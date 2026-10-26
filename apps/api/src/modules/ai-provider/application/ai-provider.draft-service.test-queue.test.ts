import { beforeEach, describe, expect, it, vi } from "vitest";

import { AiProviderDraftService } from "./ai-provider.draft-service.js";

// Orchestration only: revision loading and the safe read model are replaced so the
// assertions stay on what test() enqueues, audits and asks the repository for.
vi.mock("./ai-provider.service-support.js", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("./ai-provider.service-support.js")
  >()),
  requireRevision: vi.fn(() =>
    Promise.resolve({ id: "revision-1", generationProfile: "mistral" }),
  ),
  safeRevision: vi.fn(() => ({ id: "revision-1" })),
}));

interface Reuse {
  readonly id: string;
  readonly created: boolean;
  readonly state: "queued" | "running" | "completed";
}

const harness = (execution: Reuse) => {
  const enqueue = vi.fn().mockResolvedValue(undefined);
  const record = vi.fn();
  const createOrReuseProviderExecution = vi.fn().mockResolvedValue(execution);
  const service = new AiProviderDraftService({
    repository: { createOrReuseProviderExecution },
    testEnqueuer: { enqueue },
    audit: { record },
    codec: {},
  } as never);
  return { service, enqueue, record, createOrReuseProviderExecution };
};

const auditedEvents = (record: ReturnType<typeof vi.fn>): string[] =>
  record.mock.calls.map(([entry]) => (entry as { event: string }).event);

describe("AiProviderDraftService.test enqueue and audit (TASK-503.50 C0890)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("control: a created execution is enqueued once and audited as queued", async () => {
    const { service, enqueue, record } = harness({
      id: "execution-1",
      created: true,
      state: "queued",
    });

    await service.test("revision-1", "admin-1");

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ executionId: "execution-1" }),
    );
    expect(auditedEvents(record)).toEqual(["ai_provider.test_queued"]);
  });

  it("control: a reused queued execution is enqueued again and audited as queued", async () => {
    const { service, enqueue, record } = harness({
      id: "execution-1",
      created: false,
      state: "queued",
    });

    await service.test("revision-1", "admin-1");

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(auditedEvents(record)).toEqual(["ai_provider.test_queued"]);
  });

  it("does not enqueue and does not audit a queued event for an execution that is already running", async () => {
    const { service, enqueue, record } = harness({
      id: "execution-1",
      created: false,
      state: "running",
    });

    await service.test("revision-1", "admin-1");

    expect(enqueue).not.toHaveBeenCalled();
    expect(auditedEvents(record)).not.toContain("ai_provider.test_queued");
  });
});
