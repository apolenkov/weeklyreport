import {
  AI_PROVIDER_PROFILE_CAPABILITIES,
  type AiPromptBundleRead,
  type AiPromptContents,
  type AiPromptFeatureRead,
  type AiProviderConfigurationRead,
  type AiProviderControlRead,
} from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { AiTab } from "./ai-tab";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args) as unknown,
    error: (...args: unknown[]) => toastError(...args) as unknown,
    info: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams("tab=settings"),
}));

const ACTIVE_ID = "11111111-1111-4111-8111-111111111111";
const CANDIDATE_ID = "22222222-2222-4222-8222-222222222222";
const PROVIDER_ID = "33333333-3333-4333-8333-333333333333";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const SLOT_KEYS = [
  "planner",
  "planner-repair",
  "grounded-answer",
  "citation-repair",
] as const;

const makeBundle = (
  input: Readonly<{
    id: string;
    revision: number;
    lifecycle: AiPromptBundleRead["lifecycle"];
    hash: string;
    servingStatus?: AiPromptBundleRead["servingStatus"];
    featureKey?: string;
  }>,
): AiPromptBundleRead => {
  const instructions: AiPromptContents = {
    planner: `Plan only supported retrieval work ${input.revision}`,
    "planner-repair": `Repair the plan without broadening scope ${input.revision}`,
    "grounded-answer": `Answer from the supplied evidence ${input.revision}`,
    "citation-repair": `Repair citations from allowed sources ${input.revision}`,
  };
  const lockedCoreSnapshot = Object.fromEntries(
    SLOT_KEYS.map((slot) => [slot, `Locked safety core for ${slot}`]),
  ) as AiPromptBundleRead["lockedCoreSnapshot"];
  return {
    id: input.id,
    featureKey: (input.featureKey ??
      "lead-report-assistant") as AiPromptBundleRead["featureKey"],
    revision: input.revision,
    baseRevisionId: input.revision === 1 ? null : ACTIVE_ID,
    coreContractVersion: "report-assistant/core/v1",
    composerVersion: "report-assistant/composer/v1",
    servingContractVersion: "report-assistant/editor-serving/v1",
    servingStatus: input.servingStatus ?? "current",
    lockedCoreSnapshot,
    promptContents: instructions,
    slots: SLOT_KEYS.map((slot) => ({
      slot,
      lockedCore: lockedCoreSnapshot[slot],
      promptContents: instructions[slot],
      effectivePrompt: `${lockedCoreSnapshot[slot]}\n---\n${instructions[slot]}`,
    })),
    effectiveContentHash: input.hash,
    lifecycle: input.lifecycle,
    createdAt: new Date("2026-08-10T00:00:00.000Z"),
    updatedAt: new Date("2026-08-11T00:00:00.000Z"),
    activatedAt:
      input.lifecycle === "active"
        ? new Date("2026-08-10T00:00:00.000Z")
        : null,
    supersededAt:
      input.lifecycle === "superseded"
        ? new Date("2026-08-11T00:00:00.000Z")
        : null,
  };
};

const provider: AiProviderConfigurationRead = {
  id: PROVIDER_ID,
  lifecycle: "active",
  generation: {
    profile: "mistral",
    baseUrl: "https://api.mistral.ai/v1",
    plannerModel: "planner",
    answerModel: "answer",
    reasoningMode: "provider_default",
    reasoningCustomValue: null,
    credentialConfigured: true,
    credentialMaskedSuffix: "••••abcd",
  },
  embeddings: {
    mode: "reuse_generation",
    model: "embed",
    dimensions: 1024,
  },
  generationCompatibilityIdentity: "generation-identity",
  semanticInputVersion: "report-assistant/v1",
  testResult: null,
  progress: { completed: 0, total: 0, failed: 0, elapsedMs: 0 },
  createdAt: new Date("2026-08-10T00:00:00.000Z"),
  updatedAt: new Date("2026-08-10T00:00:00.000Z"),
  activatedAt: new Date("2026-08-10T00:00:00.000Z"),
};

const providerControl: AiProviderControlRead = {
  enabled: true,
  availability: "available",
  activeRevisionId: provider.id,
  profileCapabilities: AI_PROVIDER_PROFILE_CAPABILITIES.map(
    ({ profile, roles }) => ({ profile, roles: [...roles] }),
  ),
  active: provider,
  revisions: [provider],
};

const makeFeature = (
  candidate: AiPromptBundleRead,
  featureKey = "lead-report-assistant",
): AiPromptFeatureRead => {
  const active = makeBundle({
    id: ACTIVE_ID,
    revision: 1,
    lifecycle: "active",
    hash: HASH_A,
    featureKey,
  });
  return {
    featureKey: featureKey as AiPromptFeatureRead["featureKey"],
    displayName:
      featureKey === "lead-report-assistant"
        ? "Report Assistant"
        : "Summary Assistant",
    description:
      "Answer lead questions from authorized weekly report evidence.",
    slots: SLOT_KEYS.map((slot) => ({
      slot,
      displayName: slot,
      required: true,
    })),
    control: {
      featureKey: featureKey as AiPromptFeatureRead["featureKey"],
      activeRevisionId: active.id,
      activeBundle: active,
      latestRevision: candidate,
      history: [candidate, active],
      availability: "available",
    },
  };
};

function renderWorkspace(
  feature: AiPromptFeatureRead,
  additionalFeatures: AiPromptFeatureRead[] = [],
  catalogRead?: () => Readonly<{ features: AiPromptFeatureRead[] }>,
) {
  const features = [feature, ...additionalFeatures];
  const reads = { provider: 0, list: 0 };
  const { proxy, captured } = createMockTRPC([
    {
      path: ["admin", "aiProvider", "get"],
      query: () => {
        reads.provider += 1;
        return providerControl;
      },
    },
    { path: ["admin", "aiProvider", "save"], mutation: true },
    { path: ["admin", "aiProvider", "test"], mutation: true },
    { path: ["admin", "aiProvider", "activate"], mutation: true },
    { path: ["admin", "aiProvider", "disable"], mutation: true },
    { path: ["admin", "aiProvider", "restore"], mutation: true },
    { path: ["admin", "aiProvider", "discard"], mutation: true },
    {
      path: ["admin", "aiPrompts", "list"],
      query: () => {
        reads.list += 1;
        return catalogRead?.() ?? { features };
      },
    },
    {
      path: ["admin", "aiPrompts", "get"],
      queryByInput: (input) =>
        features.find(
          (candidate) =>
            candidate.featureKey ===
            (input as { featureKey: string }).featureKey,
        ) ?? feature,
    },
    { path: ["admin", "aiPrompts", "draft"], mutation: true },
    { path: ["admin", "aiPrompts", "activate"], mutation: true },
    { path: ["admin", "aiPrompts", "restore"], mutation: true },
    { path: ["admin", "aiPrompts", "discard"], mutation: true },
  ]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const Wrapper = ({ children }: { readonly children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TRPCProxyContext.Provider value={proxy}>
        {children}
      </TRPCProxyContext.Provider>
    </QueryClientProvider>
  );
  render(<AiTab />, { wrapper: Wrapper });
  return { captured, reads };
}

describe("AiTab", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("shows provider and feature readiness inside the tab menu", async () => {
    renderWorkspace(
      makeFeature(
        makeBundle({
          id: CANDIDATE_ID,
          revision: 2,
          lifecycle: "draft",
          hash: HASH_B,
        }),
      ),
    );

    const providerTab = await screen.findByRole("tab", { name: "Provider" });
    const featuresTab = screen.getByRole("tab", { name: "Features" });
    await waitFor(() => expect(providerTab).toHaveTextContent("ProviderReady"));
    expect(featuresTab).toHaveTextContent("Features1/1 ready");
    expect(screen.queryByText("Active and ready")).toBeNull();
    expect(screen.queryByText(/••••abcd/)).toBeNull();
  });

  it("recovers the feature catalog through the settings retry action", async () => {
    const feature = makeFeature(
      makeBundle({
        id: CANDIDATE_ID,
        revision: 2,
        lifecycle: "draft",
        hash: HASH_B,
      }),
    );
    let catalogAvailable = false;
    const { reads } = renderWorkspace(feature, [], () => {
      if (!catalogAvailable) throw new Error("catalog unavailable");
      return { features: [feature] };
    });

    const error = await screen.findByText(
      "AI feature catalog could not be loaded.",
    );
    const alert = error.closest('[role="alert"]');
    if (!(alert instanceof HTMLElement))
      throw new Error("AI settings alert was not rendered");
    const initialReads = reads.list;
    catalogAvailable = true;
    const user = userEvent.setup();
    await user.click(within(alert).getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(reads.list).toBeGreaterThan(initialReads));
    expect(
      await screen.findByRole("tab", { name: "Features" }),
    ).toHaveTextContent("1/1 ready");
  });

  it("supports keyboard navigation into the feature workspace", async () => {
    renderWorkspace(
      makeFeature(
        makeBundle({
          id: CANDIDATE_ID,
          revision: 2,
          lifecycle: "draft",
          hash: HASH_B,
        }),
      ),
    );
    const user = userEvent.setup();
    const featuresTab = screen.getByRole("tab", { name: "Features" });
    featuresTab.focus();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("button", { name: "Report Assistant" }),
    ).toBeTruthy();
  });

  it("keeps full prompts collapsed until an administrator opens one", async () => {
    const feature = makeFeature(
      makeBundle({
        id: CANDIDATE_ID,
        revision: 2,
        lifecycle: "validated",
        hash: HASH_B,
      }),
    );
    renderWorkspace(feature);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Features" }));
    await screen.findByRole("button", { name: "Report Assistant" });

    expect(screen.getByText("Prompts")).toBeTruthy();
    expect(screen.getByText("Version 1 · Active")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Activate" })).toBeEnabled();

    const plannerPrompt = screen.getByLabelText("planner prompt");
    const plannerDetails = plannerPrompt.closest("details");
    expect(plannerDetails).not.toHaveAttribute("open");
    const plannerSummary = screen
      .getAllByText("planner", { exact: true })
      .at(0);
    if (!plannerSummary)
      throw new Error("Planner prompt summary was not rendered");
    await user.click(plannerSummary);
    expect(plannerDetails).toHaveAttribute("open");
    await user.clear(plannerPrompt);
    await user.type(plannerPrompt, "A complete replacement planner prompt.");
    expect(plannerPrompt).toHaveValue("A complete replacement planner prompt.");
    expect(screen.getByRole("button", { name: "Activate" })).toBeDisabled();
    expect(
      screen.getByText(
        "Unsaved edits — save the draft before activating or restoring.",
      ),
    ).toBeTruthy();
    expect(screen.getByTestId("ai-prompt-diff")).toHaveTextContent(
      "Changed slots: planner, planner-repair, grounded-answer, citation-repair",
    );
  });

  it("keeps the selected draft visible and offers direct activation", async () => {
    const feature = makeFeature(
      makeBundle({
        id: CANDIDATE_ID,
        revision: 2,
        lifecycle: "draft",
        hash: HASH_B,
      }),
    );
    renderWorkspace(feature);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Features" }));
    await screen.findByRole("button", { name: "Report Assistant" });

    expect(screen.getByText("Draft · v2")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Evaluate" })).toBeNull();
    expect(screen.getByRole("button", { name: "Activate" })).toBeEnabled();
  });

  it("activates the selected prompt revision with an exact payload and refreshes", async () => {
    const feature = makeFeature(
      makeBundle({
        id: CANDIDATE_ID,
        revision: 2,
        lifecycle: "validated",
        hash: HASH_B,
      }),
    );
    const { captured, reads } = renderWorkspace(feature);
    const activateMutation = captured["admin.aiPrompts.activate"];
    if (!activateMutation)
      throw new Error("Activate mutation was not captured");
    activateMutation.mutationFn.mockResolvedValue(
      feature.control.latestRevision,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Features" }));
    await screen.findByRole("button", { name: "Report Assistant" });
    const initialListReads = reads.list;

    await user.click(screen.getByRole("button", { name: "Activate" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Activate" }));

    await waitFor(() =>
      expect(activateMutation.calls).toContainEqual({
        featureKey: "lead-report-assistant",
        revisionId: CANDIDATE_ID,
      }),
    );
    await waitFor(() => expect(reads.list).toBeGreaterThan(initialListReads));
  });

  it("restores a retained prompt revision with an exact payload and refreshes", async () => {
    const feature = makeFeature(
      makeBundle({
        id: CANDIDATE_ID,
        revision: 2,
        lifecycle: "superseded",
        hash: HASH_B,
      }),
    );
    const { captured, reads } = renderWorkspace(feature);
    const restoreMutation = captured["admin.aiPrompts.restore"];
    if (!restoreMutation) throw new Error("Restore mutation was not captured");
    restoreMutation.mutationFn.mockResolvedValue(
      feature.control.latestRevision,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Features" }));
    await screen.findByRole("button", { name: "Report Assistant" });
    const initialListReads = reads.list;

    await user.click(screen.getByRole("button", { name: "Restore" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Restore" }));

    await waitFor(() =>
      expect(restoreMutation.calls).toContainEqual({
        featureKey: "lead-report-assistant",
        revisionId: CANDIDATE_ID,
      }),
    );
    await waitFor(() => expect(reads.list).toBeGreaterThan(initialListReads));
  });

  it("discards a failed prompt attempt with an exact payload and refreshes", async () => {
    const feature = makeFeature(
      makeBundle({
        id: CANDIDATE_ID,
        revision: 2,
        lifecycle: "failed",
        hash: HASH_B,
      }),
    );
    const { captured, reads } = renderWorkspace(feature);
    const discardMutation = captured["admin.aiPrompts.discard"];
    if (!discardMutation) throw new Error("Discard mutation was not captured");
    discardMutation.mutationFn.mockResolvedValue(
      feature.control.latestRevision,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Features" }));
    await screen.findByRole("button", { name: "Report Assistant" });
    const initialListReads = reads.list;

    await user.click(screen.getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Discard" }));

    await waitFor(() =>
      expect(discardMutation.calls).toContainEqual({
        featureKey: "lead-report-assistant",
        revisionId: CANDIDATE_ID,
      }),
    );
    await waitFor(() => expect(reads.list).toBeGreaterThan(initialListReads));
  });

  it("sends the selected feature and edited instructions in the draft payload", async () => {
    const feature = makeFeature(
      makeBundle({
        id: CANDIDATE_ID,
        revision: 2,
        lifecycle: "draft",
        hash: HASH_B,
      }),
    );
    const { captured } = renderWorkspace(feature);
    const draftMutation = captured["admin.aiPrompts.draft"];
    if (!draftMutation) throw new Error("Draft mutation was not captured");
    draftMutation.mutationFn.mockResolvedValue(feature.control.latestRevision);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Features" }));
    await screen.findByRole("button", { name: "Report Assistant" });
    const plannerPrompt = screen.getByLabelText("planner prompt");
    await user.clear(plannerPrompt);
    await user.type(plannerPrompt, "A precise edited planner prompt");
    await user.click(screen.getByRole("button", { name: "Save Draft" }));
    await waitFor(() =>
      expect(draftMutation.calls).toContainEqual({
        featureKey: "lead-report-assistant",
        baseRevisionId: ACTIVE_ID,
        promptContents: {
          planner: "A precise edited planner prompt",
          "planner-repair": "Repair the plan without broadening scope 2",
          "grounded-answer": "Answer from the supplied evidence 2",
          "citation-repair": "Repair citations from allowed sources 2",
        },
      }),
    );
  });

  it("surfaces a rejected draft save without clearing the editor", async () => {
    const feature = makeFeature(
      makeBundle({
        id: CANDIDATE_ID,
        revision: 2,
        lifecycle: "draft",
        hash: HASH_B,
      }),
    );
    const { captured } = renderWorkspace(feature);
    const draftMutation = captured["admin.aiPrompts.draft"];
    if (!draftMutation) throw new Error("Draft mutation was not captured");
    draftMutation.mutationFn.mockRejectedValue(new Error("rejected"));
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Features" }));
    await screen.findByRole("button", { name: "Report Assistant" });
    const plannerPrompt = screen.getByLabelText("planner prompt");
    await user.clear(plannerPrompt);
    await user.type(plannerPrompt, "Keep this unsaved after rejection");
    await user.click(screen.getByRole("button", { name: "Save Draft" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "AI prompt draft could not be saved.",
      ),
    );
    expect(plannerPrompt).toHaveValue("Keep this unsaved after rejection");
  });

  it("protects retained prompt versions and keeps restore available", async () => {
    renderWorkspace(
      makeFeature(
        makeBundle({
          id: CANDIDATE_ID,
          revision: 2,
          lifecycle: "superseded",
          hash: HASH_B,
        }),
      ),
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Features" }));
    await screen.findByRole("button", { name: "Report Assistant" });

    expect(screen.getByRole("button", { name: "Restore" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
    const plannerPrompt = screen.getByLabelText("planner prompt");
    await user.clear(plannerPrompt);
    await user.type(plannerPrompt, "Keep this retained revision locally.");
    expect(screen.getByRole("button", { name: "Restore" })).toBeDisabled();
  });

  it("keeps an incompatible history entry inspectable but disables serving actions", async () => {
    renderWorkspace(
      makeFeature(
        makeBundle({
          id: CANDIDATE_ID,
          revision: 2,
          lifecycle: "superseded",
          hash: HASH_B,
          servingStatus: "incompatible",
        }),
      ),
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Features" }));
    await screen.findByRole("button", { name: "Report Assistant" });

    expect(screen.getByTestId("ai-prompt-serving-status")).toHaveTextContent(
      "Incompatible serving snapshot",
    );
    expect(screen.getByRole("button", { name: "Restore" })).toBeDisabled();
  });

  it("never carries unsaved instructions across feature selection", async () => {
    const featureA = makeFeature(
      makeBundle({
        id: CANDIDATE_ID,
        revision: 2,
        lifecycle: "draft",
        hash: HASH_B,
        featureKey: "lead-report-assistant",
      }),
    );
    const featureB = makeFeature(
      makeBundle({
        id: "44444444-4444-4444-8444-444444444444",
        revision: 3,
        lifecycle: "draft",
        hash: HASH_B,
        featureKey: "report-summary-assistant",
      }),
      "report-summary-assistant",
    );
    const { captured } = renderWorkspace(featureA, [featureB]);
    const draftMutation = captured["admin.aiPrompts.draft"];
    if (!draftMutation) throw new Error("Draft mutation was not captured");
    draftMutation.mutationFn.mockResolvedValue(featureB.control.latestRevision);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Features" }));
    await screen.findByRole("button", { name: "Report Assistant" });
    const plannerPrompt = screen.getByLabelText("planner prompt");
    await user.clear(plannerPrompt);
    await user.type(plannerPrompt, "A-only unsaved instructions");

    await user.click(screen.getByRole("button", { name: "Summary Assistant" }));
    expect(
      await screen.findByRole("button", { name: "Summary Assistant" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("planner prompt")).not.toHaveValue(
      "A-only unsaved instructions",
    );
    expect(screen.getByLabelText("planner prompt")).toHaveValue(
      "Plan only supported retrieval work 3",
    );
    await user.click(screen.getByRole("button", { name: "Save Draft" }));
    await waitFor(() =>
      expect(draftMutation.calls).toContainEqual({
        featureKey: "report-summary-assistant",
        baseRevisionId: ACTIVE_ID,
        promptContents: {
          planner: "Plan only supported retrieval work 3",
          "planner-repair": "Repair the plan without broadening scope 3",
          "grounded-answer": "Answer from the supplied evidence 3",
          "citation-repair": "Repair citations from allowed sources 3",
        },
      }),
    );
  });
});
