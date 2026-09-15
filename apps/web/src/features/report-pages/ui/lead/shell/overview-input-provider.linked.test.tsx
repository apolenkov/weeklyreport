import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { StatusOverviewItem } from "../../../../report-sections";
import {
  type LinkedReceiptContext,
  useRetainedOverviewLinkedEdits,
} from "./overview-input-provider";

function item(overrides: Partial<StatusOverviewItem>): StatusOverviewItem {
  return {
    key: "current:x",
    recordId: "x",
    source: "current",
    editTarget: { recordId: "x", source: "current" },
    stableId: null,
    text: "Work",
    tag: "delivery",
    stageNames: [],
    pausedReason: null,
    resolution: null,
    outcomeHistory: [],
    canResolve: true,
    canRestore: false,
    workflowStatus: "in_progress",
    continuity: "unplanned",
    ...overrides,
  };
}

const client = item({
  key: "current:client-1",
  recordId: "client-1",
  stableId: null,
});
const server = item({
  key: "current:server-1",
  recordId: "server-1",
  stableId: "stable-1",
});
const server2 = item({
  key: "current:server-2",
  recordId: "server-2",
  stableId: "stable-1",
});
const context: LinkedReceiptContext = {
  generation: "g1",
  sectionId: "section-1",
  receipt: {
    generation: "g1",
    reportSectionId: "section-1",
    itemIdentities: [
      { clientId: "client-1", serverId: "server-1", stableId: "stable-1" },
    ],
  },
};
const superseding: LinkedReceiptContext = {
  ...context,
  receipt: {
    generation: "g1",
    reportSectionId: "section-1",
    itemIdentities: [
      { clientId: "server-1", serverId: "server-2", stableId: "stable-1" },
    ],
  },
};

function renderLinked(
  ctx: LinkedReceiptContext | null = null,
  probe: StatusOverviewItem | null = null,
  reportId = "report-1",
) {
  return renderHook(
    ({
      ctx: value,
      reportId: currentReportId,
    }: {
      ctx: LinkedReceiptContext | null;
      reportId?: string;
    }) => {
      const memory = useRetainedOverviewLinkedEdits(
        currentReportId ?? "report-1",
        value,
      );
      if (probe) memory.read(probe);
      return memory;
    },
    { initialProps: { ctx, reportId } },
  );
}

describe("linked memory receipt adoption", () => {
  it.each([true, false, undefined])(
    "passes through the canonical baseline signal %s without a receipt",
    (currentPayloadMatchesSavedBaseline) => {
      const { result } = renderLinked({
        ...context,
        receipt: null,
        currentPayloadMatchesSavedBaseline,
      });
      expect(result.current.currentPayloadMatchesSavedBaseline).toBe(
        currentPayloadMatchesSavedBaseline === true,
      );
      expect(result.current.receiptSequence).toBe(0);
      expect(result.current.receiptConfirms?.(server, "N")).toBe(false);
    },
  );

  it("adopts the saved identity, keeps pending, and clears both keys on cancel", () => {
    const { result, rerender } = renderLinked(null, server);

    act(() => {
      result.current.write(client, {
        open: true,
        draft: "Draft",
        baseline: "",
      });
    });
    expect(result.current.pending).toBe(true);

    rerender({ ctx: context, reportId: "report-1" });
    expect(result.current.read(server)?.draft).toBe("Draft");

    act(() => {
      result.current.write(server, null);
    });
    expect(result.current.pending).toBe(false);
    expect(result.current.read(server)).toBeNull();
    expect(result.current.read(client)).toBeNull();
  });

  it("scopes pending to the active report while retaining other reports", () => {
    const { result, rerender } = renderLinked(null, null, "report-A");

    act(() => {
      result.current.write(client, {
        open: false,
        draft: "Report A draft",
        baseline: "",
      });
    });
    expect(result.current.pending).toBe(true);

    rerender({ ctx: null, reportId: "report-B" });
    expect(result.current.read(client)).toBeNull();
    expect(result.current.pending).toBe(false);

    rerender({ ctx: null, reportId: "report-A" });
    expect(result.current.read(client)?.draft).toBe("Report A draft");
    expect(result.current.pending).toBe(true);
  });

  it("ignores a receipt with null or mismatched generation/section", () => {
    const mismatches: LinkedReceiptContext[] = [
      { ...context, generation: null },
      { ...context, generation: "g2" },
      { ...context, sectionId: "other-section" },
      { ...context, scope: "new-activation" },
      {
        ...context,
        scope: "new-activation",
        receipt: {
          generation: "g1",
          reportSectionId: "section-1",
          itemIdentities: [],
          scope: "old-activation",
        },
      },
      {
        ...context,
        receipt: {
          generation: null,
          reportSectionId: "section-1",
          itemIdentities: [],
        },
      },
    ];

    for (const ctx of mismatches) {
      const { result } = renderLinked(ctx, server);
      act(() => {
        result.current.write(client, {
          open: true,
          draft: "Draft",
          baseline: "",
        });
      });
      expect(result.current.read(server)).toBeNull();
    }
  });

  it("adopts without a server read and survives a superseding receipt", () => {
    const { result, rerender } = renderLinked(null, null);
    act(() => {
      result.current.write(client, {
        open: true,
        draft: "Draft",
        baseline: "",
      });
    });

    // Matching context observed, but the server item is never read.
    rerender({ ctx: context, reportId: "report-1" });
    rerender({ ctx: superseding, reportId: "report-1" });

    expect(result.current.read(server2)?.draft).toBe("Draft");
    expect(result.current.pending).toBe(true);

    act(() => {
      result.current.write(server2, null);
    });
    expect(result.current.pending).toBe(false);
    expect(result.current.read(client)).toBeNull();
  });

  it("preserves a canonical collision and clears both drafts on the next write", () => {
    const { result, rerender } = renderLinked(null, null);
    act(() => {
      result.current.write(client, {
        open: true,
        draft: "Client draft",
        baseline: "",
      });
      result.current.write(server, {
        open: true,
        draft: "Canonical draft",
        baseline: "",
      });
    });

    rerender({ ctx: context, reportId: "report-1" });
    expect(result.current.read(server)?.draft).toBe("Canonical draft");
    expect(result.current.read(client)?.draft).toBe("Client draft");
    expect(result.current.pending).toBe(true);

    rerender({ ctx: superseding, reportId: "report-1" });
    act(() => {
      result.current.write(server, null);
    });
    expect(result.current.pending).toBe(false);
    expect(result.current.read(server)).toBeNull();
    expect(result.current.read(client)).toBeNull();
  });

  it.each([undefined, null, "Older intent", "Queued intent"])(
    "acknowledges only the exact persisted text (%s)",
    (persistedNextStepText) => {
      const { result } = renderLinked({
        ...context,
        scope: "activation-1",
        receipt: {
          generation: "g1",
          reportSectionId: "section-1",
          scope: "activation-1",
          sequence: 2,
          itemIdentities: [
            {
              clientId: "client-1",
              serverId: "server-1",
              stableId: "stable-1",
              persistedNextStepText,
            },
          ],
        },
      });
      expect(result.current.receiptConfirms?.(client, "Queued intent")).toBe(
        persistedNextStepText === "Queued intent",
      );
      expect(result.current.receiptConfirms?.(server, "Queued intent")).toBe(
        persistedNextStepText === "Queued intent",
      );
      expect(
        result.current.receiptConfirms?.(
          item({ recordId: "foreign" }),
          "Queued intent",
        ),
      ).toBe(false);
    },
  );

  it.each([undefined, "old-activation"])(
    "rejects acknowledgement and alias adoption from receipt scope %s",
    (scope) => {
      const { result } = renderLinked({
        ...context,
        scope: "new-activation",
        receipt: {
          generation: "g1",
          reportSectionId: "section-1",
          scope,
          sequence: 2,
          itemIdentities: [
            {
              clientId: "client-1",
              serverId: "server-1",
              stableId: "stable-1",
              persistedNextStepText: "Queued intent",
            },
          ],
        },
      });
      act(() =>
        result.current.write(client, {
          open: false,
          draft: "Queued intent",
          baseline: "",
          submittedReceiptSequence: 1,
          submittedReceiptScope: "new-activation",
        }),
      );
      expect(result.current.receiptConfirms?.(server, "Queued intent")).toBe(
        false,
      );
      expect(result.current.read(server)).toBeNull();
      expect(result.current.read(client)?.draft).toBe("Queued intent");
      expect(result.current.pending).toBe(true);
    },
  );
});
