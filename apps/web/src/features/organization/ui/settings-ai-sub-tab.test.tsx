import {
  AI_PROVIDER_PROFILE_CAPABILITIES,
  type AiPromptBundleRead,
  type AiPromptContents,
  type AiPromptFeatureRead,
  type AiProviderConfigurationRead,
  type AiProviderControlRead,
} from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../lib/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { SettingsAiSubTab } from "./settings-ai-sub-tab";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args) as unknown,
    error: (...args: unknown[]) => toastError(...args) as unknown,
    info: vi.fn(),
  },
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
    featureKey: "lead-report-assistant",
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

const makeFeature = (candidate: AiPromptBundleRead): AiPromptFeatureRead => {
  const active = makeBundle({
    id: ACTIVE_ID,
    revision: 1,
    lifecycle: "active",
    hash: HASH_A,
  });
  return {
    featureKey: "lead-report-assistant",
    displayName: "Report Assistant",
    description:
      "Answer lead questions from authorized weekly report evidence.",
    slots: SLOT_KEYS.map((slot) => ({
      slot,
      displayName: slot,
      required: true,
    })),
    control: {
      featureKey: "lead-report-assistant",
      activeRevisionId: active.id,
      activeBundle: active,
      latestRevision: candidate,
      history: [candidate, active],
      availability: "available",
    },
  };
};

function renderWorkspace(feature: AiPromptFeatureRead) {
  const { proxy, captured } = createMockTRPC([
    { path: ["admin", "aiProvider", "get"], query: providerControl },
    {
      path: ["admin", "aiPrompts", "list"],
      query: { features: [feature] },
    },
    {
      path: ["admin", "aiPrompts", "get"],
      queryByInput: () => feature,
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
  render(<SettingsAiSubTab />, { wrapper: Wrapper });
  return { captured };
}

describe("SettingsAiSubTab", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("provides safe local navigation and a registered feature overview", async () => {
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

    expect(await screen.findByRole("tab", { name: "Overview" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Provider" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Features" })).toBeTruthy();
    expect(await screen.findByText("Registered features")).toBeTruthy();
    expect(screen.queryByText(/••••abcd/)).toBeNull();
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
  });

  it("keeps legacy history inspectable but disables serving actions", async () => {
    renderWorkspace(
      makeFeature(
        makeBundle({
          id: CANDIDATE_ID,
          revision: 2,
          lifecycle: "superseded",
          hash: HASH_B,
          servingStatus: "legacy",
        }),
      ),
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Features" }));
    await screen.findByRole("button", { name: "Report Assistant" });

    expect(screen.getByTestId("ai-prompt-serving-status")).toHaveTextContent(
      "Legacy serving contract",
    );
    expect(screen.getByRole("button", { name: "Restore" })).toBeDisabled();
  });
});
