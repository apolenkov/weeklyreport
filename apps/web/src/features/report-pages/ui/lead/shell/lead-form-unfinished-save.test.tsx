import "@testing-library/jest-dom/vitest";

import { QueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import {
  incompleteDraftSaveSchema,
  type ReportSectionReadModel,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../../../test-utils/expect-defined";
import { DecisionCard } from "../../../../period/ui/decision-card";
import type { DecisionEntry, RiskEntry } from "../../../../report-sections";
import type { LeadFormDraftSaveInput } from "../../../../report-sections/model/lead-form/lead-form-write-port";
import { LeadFormWriteError } from "../../../../report-sections/model/lead-form/lead-form-write-port";
import { InMemoryLeadFormWriteAdapter } from "../../../../report-sections/model/lead-form/lead-form-write-port.in-memory";
import { RiskCard } from "../../../../review/ui/risk-card";
import {
  buildWrapper,
  makeSection,
  PROJECT_ID,
} from "./lead-form-editor-test-harness";
import {
  type LeadFormEditorHandle,
  useLeadFormEditorWithPort,
} from "./use-lead-form-editor";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/lead/report",
}));

const risk: RiskEntry = {
  id: "66666666-6666-4666-8666-666666666666",
  productId: PROJECT_ID,
  productName: "Test Product",
  stageNames: ["Development"],
  severity: "at-risk",
  text: "Unfinished risk",
  impact: "",
  mitigation: "",
};
const decision: DecisionEntry = {
  id: "77777777-7777-4777-8777-777777777777",
  productId: PROJECT_ID,
  productName: "Test Product",
  stageNames: ["Development"],
  text: "Unfinished decision",
  owner: "Test Lead",
  impact: "",
  deadline: null,
};
const noop = () => undefined;

function savedSection(input: LeadFormDraftSaveInput): ReportSectionReadModel {
  const parsed = incompleteDraftSaveSchema.parse(input);
  return {
    ...makeSection(input.version + 1),
    projects: makeSection().projects.map((project) => ({
      ...project,
      trafficLight:
        parsed.projectStatuses.find(
          (status) => status.projectId === project.projectId,
        )?.status ?? project.trafficLight,
    })),
    risks: parsed.risks.map((r) => ({
      ...r,
      id: r.id ?? risk.id,
      impact: r.impact ?? "",
      mitigation: r.mitigation ?? "",
      stageNames: r.stageNames ?? [],
    })),
    decisions: parsed.decisions.map((d) => ({
      ...d,
      id: d.id ?? decision.id,
      impact: d.impact ?? "",
      stageNames: d.stageNames ?? [],
    })),
  };
}

async function setup(
  server = { current: makeSection() as ReportSectionReadModel },
) {
  const requests: {
    input: LeadFormDraftSaveInput;
    resolve: (section: ReportSectionReadModel) => void;
    reject: (error: Error) => void;
  }[] = [];
  const port = new InMemoryLeadFormWriteAdapter({
    saveDraft: (input) =>
      new Promise((resolve, reject) =>
        requests.push({ input, resolve, reject }),
      ),
    submit: () => Promise.reject(new Error("Unexpected submit")),
  });
  let latest: LeadFormEditorHandle | undefined;
  function Cards() {
    latest = useLeadFormEditorWithPort({}, port);
    if (latest.status !== "ready") return null;
    return (
      <>
        {latest.view.viewModel.risks.map((entry) => (
          <RiskCard
            key={entry.id}
            risk={entry}
            readOnly={false}
            onEdit={noop}
            onDelete={noop}
          />
        ))}
        {latest.view.viewModel.decisions.map((entry) => (
          <DecisionCard
            key={entry.id}
            decision={entry}
            readOnly={false}
            publishedLocked={false}
            onEdit={noop}
            onDelete={noop}
          />
        ))}
      </>
    );
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const rendered = render(<Cards />, {
    wrapper: buildWrapper({ client, section: () => server.current }),
  });
  await waitFor(() => expect(latest?.status).toBe("ready"));
  const ready = () => {
    if (latest?.status !== "ready") throw new Error("Editor not ready");
    return latest;
  };
  act(() => {
    ready().view.draftActions.onRisksChange([risk]);
    ready().view.draftActions.onDecisionsChange([decision]);
  });
  return { ...rendered, ready, requests, port, client, server };
}

async function updateEditor(
  change: () => void | Promise<unknown>,
): Promise<void> {
  await act(async () => {
    await change();
  });
}

function expectNotes(prefix: string) {
  expect(screen.getByTestId("risk-unfinished-note")).toHaveTextContent(prefix);
  expect(screen.getByTestId("decision-unfinished-note")).toHaveTextContent(
    prefix,
  );
}

describe("unfinished cards through the real editor save owner", () => {
  it("waits for the nullable save ACK before claiming either row is saved", async () => {
    const h = await setup();
    expectNotes("Save pending, unfinished");
    await updateEditor(() => {
      void h.ready().draft.save();
    });
    expect(h.requests).toHaveLength(1);
    expectNotes("Save pending, unfinished");
    const request = expectDefined(h.requests[0]);
    expect(request.input.risks[0]).toMatchObject({
      stableId: risk.id,
      impact: null,
      mitigation: null,
    });
    expect(request.input.decisions[0]).toMatchObject({
      stableId: decision.id,
      impact: null,
    });
    await updateEditor(() => request.resolve(savedSection(request.input)));
    expectNotes("Saved, unfinished");
    expect(h.ready().draft.section.risks).toHaveLength(1);
    expect(h.ready().draft.section.decisions).toHaveLength(1);
  });

  it("does not label newer text saved when the older response arrives", async () => {
    const h = await setup();
    await updateEditor(() => {
      void h.ready().draft.save();
    });
    const first = expectDefined(h.requests[0]);
    act(() => {
      h.ready().view.draftActions.onRisksChange([
        {
          ...expectDefined(h.ready().view.viewModel.ownRisks[0]),
          text: "Newer risk",
        },
      ]);
      h.ready().view.draftActions.onDecisionsChange([
        {
          ...expectDefined(h.ready().view.viewModel.ownDecisions[0]),
          text: "Newer decision",
        },
      ]);
    });
    await updateEditor(() => first.resolve(savedSection(first.input)));
    expectNotes("Save pending, unfinished");
    expect(screen.getByText("Newer risk")).toBeVisible();
    expect(screen.getByText("Newer decision")).toBeVisible();
    await updateEditor(() => {
      void h.ready().draft.save();
    });
    const second = expectDefined(h.requests[1]);
    expect(second.input.risks[0]?.stableId).toBe(
      first.input.risks[0]?.stableId,
    );
    expect(second.input.decisions[0]?.stableId).toBe(
      first.input.decisions[0]?.stableId,
    );
    await updateEditor(() => second.resolve(savedSection(second.input)));
    expectNotes("Saved, unfinished");
  });

  it("retains unfinished input and shows failure on a rejected write", async () => {
    const h = await setup();
    await updateEditor(() => {
      void h.ready().draft.savePersisted("rejected");
    });
    await updateEditor(() =>
      expectDefined(h.requests[0]).reject(
        new LeadFormWriteError("restriction", "Save refused"),
      ),
    );
    expectNotes("Save failed, unfinished");
    expect(screen.getByText("Unfinished risk")).toBeVisible();
    expect(screen.getByText("Unfinished decision")).toBeVisible();
  });

  it("keeps a lost ACK unconfirmed and retries the exact nullable payload and version", async () => {
    const h = await setup();
    await updateEditor(() => {
      void h.ready().draft.savePersisted("lost-ack");
    });
    const first = expectDefined(h.requests[0]);
    await updateEditor(() =>
      first.reject(new LeadFormWriteError("ambiguous", "Response lost")),
    );
    expectNotes("Save unconfirmed, unfinished");
    act(() =>
      expect(h.ready().draft.retrySameAttempt?.("lost-ack")).toBe(true),
    );
    expect(expectDefined(h.requests[1]).input).toEqual(first.input);
    await updateEditor(() =>
      expectDefined(h.requests[1]).resolve(savedSection(first.input)),
    );
    expectNotes("Saved, unfinished");
    expect(h.ready().draft.section.risks).toHaveLength(1);
    expect(h.ready().draft.section.decisions).toHaveLength(1);
  });

  it.each([
    ["restriction", "Save failed, unfinished"],
    ["ambiguous", "Save unconfirmed, unfinished"],
  ] as const)(
    "classifies an ordinary autosave %s response",
    async (kind, label) => {
      const h = await setup();
      await updateEditor(() => {
        void h.ready().draft.save();
      });
      await updateEditor(() =>
        expectDefined(h.requests[0]).reject(
          new LeadFormWriteError(kind, "Save did not confirm"),
        ),
      );
      expectNotes(label);
      expect(h.ready().draft.section.risks).toHaveLength(1);
      expect(h.ready().draft.section.decisions).toHaveLength(1);
    },
  );

  it("cannot confirm a new activation from an unmounted editor's late response", async () => {
    const old = await setup();
    await updateEditor(() => {
      void old.ready().draft.savePersisted("old-activation");
    });
    old.unmount();
    const current = await setup();
    const oldRequest = expectDefined(old.requests[0]);
    await updateEditor(() =>
      oldRequest.resolve(savedSection(oldRequest.input)),
    );
    expectNotes("Save pending, unfinished");
    expect(current.requests).toHaveLength(0);
    expect(current.ready().draft.lastSaveReceipt).toBeNull();
  });

  it("keeps an unfinished pending or ambiguous attempt owned when cancellation is unproven", async () => {
    const h = await setup();
    await updateEditor(() => {
      void h.ready().draft.savePersisted("owned-attempt");
    });
    act(() => {
      h.ready().draft.abandonPersisted("another-attempt");
      h.ready().draft.abandonPersisted("owned-attempt");
    });
    expect(h.ready().draft.saveRecovery?.token).toBe("owned-attempt");
    expectNotes("Save pending, unfinished");
    const request = expectDefined(h.requests[0]);
    await updateEditor(() =>
      request.reject(new LeadFormWriteError("ambiguous", "Response lost")),
    );
    act(() => h.ready().draft.abandonPersisted("owned-attempt"));
    expect(h.ready().draft.saveRecovery?.token).toBe("owned-attempt");
    expectNotes("Save unconfirmed, unfinished");
    expect(h.ready().draft.section.risks).toHaveLength(1);
    expect(h.ready().draft.section.decisions).toHaveLength(1);
    act(() => {
      h.ready().draft.retrySameAttempt?.("owned-attempt");
    });
    await updateEditor(() =>
      expectDefined(h.requests[1]).resolve(savedSection(request.input)),
    );
    expectNotes("Saved, unfinished");
  });

  it.each(["before", "after"] as const)(
    "retains nullable rows when the newer read arrives %s a 409",
    async (order) => {
      const h = await setup();
      await updateEditor(() => {
        void h.ready().draft.save();
      });
      const first = expectDefined(h.requests[0]);
      act(() => {
        h.ready().view.draftActions.onRisksChange([
          {
            ...expectDefined(h.ready().view.viewModel.ownRisks[0]),
            text: "Latest risk input",
          },
        ]);
        h.ready().view.draftActions.onDecisionsChange([
          {
            ...expectDefined(h.ready().view.viewModel.ownDecisions[0]),
            text: "Latest decision input",
          },
        ]);
      });
      h.server.current = {
        ...makeSection(3),
        projects: makeSection().projects.map((project) => ({
          ...project,
          trafficLight: "red",
        })),
      };
      if (order === "before") {
        await updateEditor(() =>
          h.client.refetchQueries({ queryKey: [["leadForm", "byPeriod"]] }),
        );
        await waitFor(() =>
          expect(h.ready().view.data.byPeriodData?.section.version).toBe(3),
        );
      }
      await updateEditor(() =>
        first.reject(new LeadFormWriteError("conflict", "Stale version")),
      );
      await waitFor(() => expect(h.ready().draft.version).toBe(3));
      expectNotes("Save failed, unfinished");
      expect(screen.getByText("Latest risk input")).toBeVisible();
      expect(screen.getByText("Latest decision input")).toBeVisible();
      expect(h.ready().draft.section.projects[0]?.trafficLight).toBe("red");
      expect(h.requests).toHaveLength(1);
      await updateEditor(() => {
        void h.ready().draft.save();
      });
      const retried = expectDefined(h.requests[1]);
      expect(retried.input.version).toBe(3);
      expect(retried.input.risks[0]?.stableId).toBe(
        first.input.risks[0]?.stableId,
      );
      expect(retried.input.decisions[0]?.stableId).toBe(
        first.input.decisions[0]?.stableId,
      );
      await updateEditor(() => retried.resolve(savedSection(retried.input)));
      expectNotes("Saved, unfinished");
    },
  );

  it("does not borrow a clean payload's saved state for rows filtered out of it", async () => {
    const h = await setup();
    act(() => {
      h.ready().view.draftActions.onRisksChange([
        { ...risk, text: "", impact: "Local impact" },
      ]);
      h.ready().view.draftActions.onDecisionsChange([
        { ...decision, text: "" },
      ]);
    });
    expectNotes("Not saved, unfinished");
    expect(h.ready().draft.autosave.currentPayloadMatchesSavedBaseline).toBe(
      true,
    );
    expect(h.requests).toHaveLength(0);
  });

  it.each(["before", "after"] as const)(
    "retains details completed during a nullable save when the newer read arrives %s its 409",
    async (order) => {
      const h = await setup();
      await updateEditor(() => {
        void h.ready().draft.save();
      });
      const request = expectDefined(h.requests[0]);
      act(() => {
        h.ready().view.draftActions.onRisksChange([
          {
            ...expectDefined(h.ready().view.viewModel.ownRisks[0]),
            impact: "Completed impact",
            mitigation: "Completed mitigation",
          },
        ]);
        h.ready().view.draftActions.onDecisionsChange([
          {
            ...expectDefined(h.ready().view.viewModel.ownDecisions[0]),
            impact: "Completed decision impact",
          },
        ]);
      });
      h.server.current = makeSection(3);
      if (order === "before") {
        await updateEditor(() =>
          h.client.refetchQueries({ queryKey: [["leadForm", "byPeriod"]] }),
        );
        await waitFor(() =>
          expect(h.ready().view.data.byPeriodData?.section.version).toBe(3),
        );
      }
      await updateEditor(() =>
        request.reject(new LeadFormWriteError("conflict", "Stale version")),
      );
      await waitFor(() => expect(h.ready().draft.version).toBe(3));
      expect(h.ready().draft.section.risks).toEqual([
        expect.objectContaining({
          stableId: risk.id,
          impact: "Completed impact",
          mitigation: "Completed mitigation",
        }),
      ]);
      expect(h.ready().draft.section.decisions).toEqual([
        expect.objectContaining({
          stableId: decision.id,
          impact: "Completed decision impact",
        }),
      ]);
      expect(h.ready().draft.autosave.state).toBe("error");
      expect(h.ready().draft.dirty).toBe(true);
      expect(h.requests).toHaveLength(1);
      await updateEditor(() => {
        void h.ready().draft.save();
      });
      const reconciled = expectDefined(h.requests[1]);
      expect(reconciled.input.version).toBe(3);
      await updateEditor(() =>
        reconciled.resolve(savedSection(reconciled.input)),
      );
      expect(h.ready().draft.autosave.currentPayloadMatchesSavedBaseline).toBe(
        true,
      );
    },
  );

  it("overlays only local changes on an existing unfinished row and retains server identity and other fields", async () => {
    const h = await setup();
    await updateEditor(() => {
      void h.ready().draft.save();
    });
    const initial = expectDefined(h.requests[0]);
    h.server.current = savedSection(initial.input);
    await updateEditor(() => initial.resolve(h.server.current));
    await updateEditor(() => {
      return h.client.refetchQueries({ queryKey: [["leadForm", "byPeriod"]] });
    });
    expectNotes("Saved, unfinished");
    act(() => {
      h.ready().view.draftActions.onRisksChange([
        {
          ...expectDefined(h.ready().view.viewModel.ownRisks[0]),
          text: "Local risk edit",
        },
      ]);
      h.ready().view.draftActions.onDecisionsChange([
        {
          ...expectDefined(h.ready().view.viewModel.ownDecisions[0]),
          text: "Local decision edit",
        },
      ]);
    });
    await updateEditor(() => {
      void h.ready().draft.save();
    });
    h.server.current = {
      ...h.server.current,
      version: 4,
      risks: h.server.current.risks.map((row) => ({
        ...row,
        id: "server-risk",
        mitigation: "New server mitigation",
        severity: "blocked",
      })),
      decisions: h.server.current.decisions.map((row) => ({
        ...row,
        id: "server-decision",
        deadline: new Date("2026-12-01"),
      })),
    };
    await updateEditor(() =>
      expectDefined(h.requests[1]).reject(
        new LeadFormWriteError("conflict", "Stale version"),
      ),
    );
    await waitFor(() => expect(h.ready().draft.version).toBe(4));
    expectNotes("Save failed, unfinished");
    expect(h.ready().draft.section.risks).toEqual([
      expect.objectContaining({
        id: "server-risk",
        stableId: risk.id,
        risk: "Local risk edit",
        mitigation: "New server mitigation",
        severity: "blocked",
      }),
    ]);
    expect(h.ready().draft.section.decisions).toEqual([
      expect.objectContaining({
        id: "server-decision",
        stableId: decision.id,
        text: "Local decision edit",
        deadline: new Date("2026-12-01"),
      }),
    ]);
    expect(h.requests).toHaveLength(2);
  });
});
