import {
  AI_PROVIDER_PROFILE_CAPABILITIES,
  type AiProviderConfigurationRead,
  type AiProviderControlRead,
  type AiProviderDraft,
  aiProviderDraftSchema,
} from "@customreport/shared";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AiProviderCardContent } from "./ai-provider-card";
import { providerTestExecutionMessage } from "./ai-provider-mutations";
import { AiProviderRetainedRevisions } from "./ai-provider-retained-revisions";
import { AiProviderRevisionDetails } from "./ai-provider-revision-details";
import {
  initialAiProviderCardExpanded,
  selectObservedRevision,
} from "./ai-provider-revision-selection";

const revision = (
  lifecycle: AiProviderConfigurationRead["lifecycle"],
  id = lifecycle === "active"
    ? "11111111-1111-4111-8111-111111111111"
    : `11111111-1111-4111-8111-11111111111${lifecycle.length}`,
): AiProviderConfigurationRead => ({
  id,
  lifecycle,
  generation: {
    profile: "mistral",
    baseUrl: "https://api.mistral.ai/v1",
    plannerModel: "planner",
    answerModel: "answer",
    reasoningMode: "provider_default",
    reasoningCustomValue: null,
    credentialConfigured: true,
    credentialMaskedSuffix: "••••test",
  },
  embeddings: {
    mode: "reuse_generation",
    model: "embed",
    dimensions: 3,
  },
  generationCompatibilityIdentity: "generation-identity",
  semanticInputVersion: "v1",
  testResult: null,
  progress: { completed: 0, total: 0, failed: 0, elapsedMs: 0 },
  createdAt: new Date(),
  updatedAt: new Date(),
  activatedAt: null,
});

const control = (
  active: AiProviderConfigurationRead | null,
): AiProviderControlRead => ({
  enabled: active?.lifecycle === "active",
  availability: active ? "available" : "not_configured",
  activeRevisionId: active?.id ?? null,
  profileCapabilities: AI_PROVIDER_PROFILE_CAPABILITIES.map(
    ({ profile, roles }) => ({ profile, roles: [...roles] }),
  ),
  active,
  revisions: active ? [active] : [],
});

describe("initialAiProviderCardExpanded", () => {
  it("keeps an in-progress activation ahead of a newer failed draft", () => {
    const preparing = {
      ...revision("preparing"),
      updatedAt: new Date("2026-08-14T06:18:05.000Z"),
    };
    const failed = {
      ...revision("failed"),
      updatedAt: new Date("2026-08-14T06:27:00.000Z"),
    };

    expect(
      selectObservedRevision(
        { ...control(null), revisions: [failed, preparing] },
        failed,
      ),
    ).toMatchObject({ id: preparing.id, lifecycle: "preparing" });
  });

  it("keeps a stable active provider compact", () => {
    expect(
      initialAiProviderCardExpanded(
        control(revision("active")),
        revision("active"),
        null,
      ),
    ).toBe(false);
  });

  it.each(["draft", "failed", "preparing"] as const)(
    "expands a %s attempt",
    (lifecycle) => {
      const item = revision(lifecycle);
      expect(initialAiProviderCardExpanded(control(item), item, null)).toBe(
        true,
      );
    },
  );

  it("expands an unconfigured or failed operation state", () => {
    expect(initialAiProviderCardExpanded(control(null), null, null)).toBe(true);
    expect(
      initialAiProviderCardExpanded(
        control(revision("active")),
        revision("active"),
        "Failed",
      ),
    ).toBe(true);
  });
});

describe("providerTestExecutionMessage", () => {
  it("reports a complete passing result for an active revision", () => {
    const active: AiProviderConfigurationRead = {
      ...revision("active"),
      testResult: {
        status: "passed",
        generation: {
          status: "passed",
          capabilities: [],
        },
        embeddings: { status: "passed", capabilities: [] },
        testedAt: new Date("2026-08-14T06:17:00.000Z"),
      },
      latestExecution: {
        id: "22222222-2222-4222-8222-222222222222",
        testSuiteVersion: "provider-test-v1",
        state: "completed",
        outcome: "passed",
        failureCode: null,
        checks: [],
        requestedAt: new Date("2026-08-14T06:16:00.000Z"),
        startedAt: new Date("2026-08-14T06:16:01.000Z"),
        completedAt: new Date("2026-08-14T06:17:00.000Z"),
      },
    };

    expect(providerTestExecutionMessage(active)).toBe(
      "Generation, planner, answer, and embeddings passed.",
    );
  });

  it("tells the administrator to replace a rejected credential", () => {
    const failed: AiProviderConfigurationRead = {
      ...revision("failed"),
      latestExecution: {
        id: "22222222-2222-4222-8222-222222222222",
        testSuiteVersion: "provider-test-v1",
        state: "completed",
        outcome: "configuration_error",
        failureCode: "provider_authentication_failed",
        checks: [],
        requestedAt: new Date("2026-08-13T20:16:40.000Z"),
        startedAt: new Date("2026-08-13T20:16:41.000Z"),
        completedAt: new Date("2026-08-13T20:16:42.000Z"),
      },
    };

    expect(providerTestExecutionMessage(failed)).toBe(
      "Generation authentication failed. Replace the rejected provider credential and save a new draft.",
    );
  });
});

const mutations = () => {
  const mutation = () => ({
    isPending: false,
    isError: false,
    mutate: vi.fn(),
  });
  return {
    save: mutation(),
    test: mutation(),
    activate: mutation(),
    disable: mutation(),
    restore: mutation(),
    discard: mutation(),
  };
};

describe("AiProviderCardContent", () => {
  it("renders the fixed mask-only credential metadata", () => {
    const active = revision("active");
    render(
      <AiProviderRevisionDetails
        revision={{
          ...active,
          generation: {
            ...active.generation,
            credentialMaskedSuffix: "••••",
          },
        }}
      />,
    );

    expect(screen.getByTestId("integration-ai-credential")).toHaveTextContent(
      "••••",
    );
  });

  it("sends exact revision payloads for test, activation, and disable", () => {
    const draft = revision("draft");
    const testMutations = mutations();
    render(
      <AiProviderCardContent
        data={{ ...control(null), revisions: [draft] }}
        savedRevision={draft}
        message={null}
        mutations={testMutations as never}
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Test capabilities" }));
    expect(testMutations.test.mutate).toHaveBeenCalledWith({
      revisionId: draft.id,
    });

    const validated = revision("validated");
    const activationMutations = mutations();
    render(
      <AiProviderCardContent
        data={{ ...control(null), revisions: [validated] }}
        savedRevision={validated}
        message={null}
        mutations={activationMutations as never}
        onSave={vi.fn()}
      />,
    );
    const activationButton = screen
      .getAllByRole("button", { name: "Activate" })
      .at(-1);
    if (!activationButton)
      throw new Error("Activation button was not rendered");
    fireEvent.click(activationButton);
    const activationDialog = screen.getAllByRole("alertdialog").at(-1);
    if (!activationDialog)
      throw new Error("Activation dialog was not rendered");
    fireEvent.click(
      within(activationDialog).getByRole("button", { name: "Activate" }),
    );
    expect(activationMutations.activate.mutate).toHaveBeenCalledWith({
      revisionId: validated.id,
    });

    const active = revision("active");
    const disableMutations = mutations();
    render(
      <AiProviderCardContent
        data={control(active)}
        savedRevision={null}
        message={null}
        mutations={disableMutations as never}
        onSave={vi.fn()}
      />,
    );
    const disclosure = screen
      .getAllByRole("button", { name: "Toggle AI provider settings" })
      .at(-1);
    if (!disclosure) throw new Error("Provider disclosure was not rendered");
    fireEvent.click(disclosure);
    const disableButton = screen
      .getAllByRole("button", { name: "Disable" })
      .at(-1);
    if (!disableButton) throw new Error("Disable button was not rendered");
    fireEvent.click(disableButton);
    const disableDialog = screen.getAllByRole("alertdialog").at(-1);
    if (!disableDialog) throw new Error("Disable dialog was not rendered");
    fireEvent.click(
      within(disableDialog).getByRole("button", { name: "Disable" }),
    );
    expect(disableMutations.disable.mutate).toHaveBeenCalledWith();
  });

  it("keeps the expanded configuration compact and responsive", () => {
    render(
      <AiProviderCardContent
        data={control(null)}
        savedRevision={null}
        message={null}
        mutations={mutations() as never}
        onSave={vi.fn()}
      />,
    );

    const card = screen.getByTestId("integration-row-ai");
    expect(card).toHaveClass("border-t", "pt-4", "sm:pt-5");
    expect(card).not.toHaveClass("rounded-[var(--radius-md)]");
    expect(card).not.toHaveClass("bg-[var(--color-surface)]");
    expect(card).not.toHaveClass("shadow-xs");

    const configuration = screen.getByTestId(
      "ai-provider-configuration-layout",
    );
    expect(configuration).toHaveClass("grid", "gap-5", "lg:grid-cols-12");
    expect(screen.getByTestId("ai-provider-generation-column")).toHaveClass(
      "lg:col-span-7",
    );
    expect(screen.getByTestId("ai-provider-embeddings-column")).toHaveClass(
      "lg:col-span-5",
    );
    expect(
      screen.getByTestId("ai-provider-generation-section"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("ai-provider-embeddings-section"),
    ).toBeInTheDocument();
  });

  it("offers activation recovery while preventing a competing draft", () => {
    const preparing = revision("preparing");
    const failed = revision("failed");
    const cardMutations = mutations();
    render(
      <AiProviderCardContent
        data={{ ...control(null), revisions: [failed, preparing] }}
        savedRevision={failed}
        message={null}
        mutations={cardMutations as never}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Test capabilities" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Resume activation" }));
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));

    expect(cardMutations.activate.mutate).toHaveBeenCalledWith({
      revisionId: preparing.id,
    });
  });

  it("submits the observed revision as the credential-retention source", () => {
    const failed = revision("failed");
    const onSave = vi.fn<(draft: AiProviderDraft) => void>();
    render(
      <AiProviderCardContent
        data={control(null)}
        savedRevision={failed}
        message={null}
        mutations={mutations() as never}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ baseRevisionId: failed.id }),
    );
  });

  it("provides an accessible compact summary without credentials", () => {
    const active = revision("active");
    render(
      <AiProviderCardContent
        data={control(active)}
        savedRevision={null}
        message={null}
        mutations={mutations() as never}
        onSave={vi.fn<(draft: AiProviderDraft) => void>()}
      />,
    );

    const disclosure = screen.getByRole("button", {
      name: "Toggle AI provider settings",
    });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Mistral · answer")).toBeInTheDocument();
    expect(screen.queryByText("••••test")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("ai-provider-disclosure-indicator"),
    ).toBeInTheDocument();

    fireEvent.click(disclosure);
    const diagnostics = screen.getByTestId("ai-provider-diagnostics");
    expect(diagnostics).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Diagnostics", { exact: true }));
    expect(diagnostics).toHaveAttribute("open");
  });

  it("preserves an explicit disclosure choice across refetches", () => {
    const active = revision("active");
    const view = render(
      <AiProviderCardContent
        data={control(active)}
        savedRevision={null}
        message={null}
        mutations={mutations() as never}
        onSave={vi.fn()}
      />,
    );
    const disclosure = screen.getByRole("button", {
      name: "Toggle AI provider settings",
    });

    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute("aria-expanded", "true");

    view.rerender(
      <AiProviderCardContent
        data={control(active)}
        savedRevision={null}
        message={null}
        mutations={mutations() as never}
        onSave={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Toggle AI provider settings" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("shows a safe alert when discard fails", () => {
    const active = revision("active");
    const failed = revision("failed");
    const cardMutations = mutations();
    cardMutations.discard.isError = true;
    render(
      <AiProviderCardContent
        data={{ ...control(active), revisions: [active, failed] }}
        savedRevision={failed}
        message="The attempt could not be discarded."
        operationFailed
        mutations={cardMutations as never}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The attempt could not be discarded.",
    );
  });

  it("shows the current save error instead of an inconsistent historical result", () => {
    const failed = revision("failed");
    const historical: AiProviderConfigurationRead = {
      ...failed,
      latestExecution: {
        id: "22222222-2222-4222-8222-222222222222",
        testSuiteVersion: "provider-test-v1",
        state: "completed",
        outcome: "passed",
        failureCode: null,
        checks: [],
        requestedAt: new Date("2026-08-12T00:00:00.000Z"),
        startedAt: new Date("2026-08-12T00:00:01.000Z"),
        completedAt: new Date("2026-08-12T00:00:02.000Z"),
      },
    };
    const cardMutations = mutations();
    cardMutations.save.isError = true;

    render(
      <AiProviderCardContent
        data={{ ...control(null), revisions: [historical] }}
        savedRevision={null}
        message="Provider endpoint is not allowlisted"
        operationFailed
        mutations={cardMutations as never}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Provider endpoint is not allowlisted",
    );
  });

  it("shows current successful operation feedback over a historical result", () => {
    const failed = revision("failed");
    const historical: AiProviderConfigurationRead = {
      ...failed,
      latestExecution: {
        id: "22222222-2222-4222-8222-222222222222",
        testSuiteVersion: "provider-test-v1",
        state: "completed",
        outcome: "passed",
        failureCode: null,
        checks: [],
        requestedAt: new Date("2026-08-12T00:00:00.000Z"),
        startedAt: new Date("2026-08-12T00:00:01.000Z"),
        completedAt: new Date("2026-08-12T00:00:02.000Z"),
      },
    };

    render(
      <AiProviderCardContent
        data={{ ...control(null), revisions: [historical] }}
        savedRevision={null}
        message="Draft saved. Test it before activation."
        mutations={mutations() as never}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Draft saved. Test it before activation.",
    );
  });

  it("does not render a stale mutation error as an alert after a later success", () => {
    const cardMutations = mutations();
    cardMutations.discard.isError = true;

    render(
      <AiProviderCardContent
        data={control(null)}
        savedRevision={null}
        message="Draft saved. Test it before activation."
        mutations={cardMutations as never}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Draft saved. Test it before activation.",
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("switches Groq generation to a valid separate embedding connection", () => {
    const onSave = vi.fn<(draft: AiProviderDraft) => void>();
    render(
      <AiProviderCardContent
        data={control(null)}
        savedRevision={null}
        message={null}
        mutations={mutations() as never}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Generation provider profile"), {
      target: { value: "groq" },
    });

    const embeddingMode = screen.getByLabelText("Embedding connection mode");
    expect(embeddingMode).toHaveValue("separate");
    expect(embeddingMode).toBeDisabled();
    expect(
      screen.getByText(
        "The selected generation provider does not support embeddings. Configure a separate embedding provider.",
      ),
    ).toBeTruthy();
    expect(
      within(embeddingMode).queryByRole("option", {
        name: "Same connection as generation",
      }),
    ).toBeNull();

    fireEvent.change(screen.getByLabelText("Planner model"), {
      target: { value: "groq-planner" },
    });
    fireEvent.change(screen.getByLabelText("Answer model"), {
      target: { value: "groq-answer" },
    });
    fireEvent.change(screen.getByLabelText("Embedding model"), {
      target: { value: "mistral-embed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    const draft = onSave.mock.calls[0]?.[0];
    expect(draft?.embeddings).toMatchObject({
      mode: "separate",
      profile: "mistral",
    });
    expect(aiProviderDraftSchema.safeParse(draft).success).toBe(true);
  });

  it("replaces the queued mutation snapshot with the terminal polled execution", () => {
    const failed = revision("failed");
    const queued: AiProviderConfigurationRead = {
      ...failed,
      latestExecution: {
        id: "22222222-2222-4222-8222-222222222222",
        testSuiteVersion: "provider-test-v1",
        state: "queued",
        outcome: null,
        failureCode: null,
        checks: [],
        requestedAt: new Date("2026-08-12T00:00:00.000Z"),
        startedAt: null,
        completedAt: null,
      },
    };
    const inconclusive: AiProviderConfigurationRead = {
      ...failed,
      latestExecution: {
        id: "22222222-2222-4222-8222-222222222222",
        testSuiteVersion: "provider-test-v1",
        checks: [],
        requestedAt: new Date("2026-08-12T00:00:00.000Z"),
        state: "completed",
        outcome: "inconclusive",
        failureCode: "provider_transient_failure",
        startedAt: new Date("2026-08-12T00:00:01.000Z"),
        completedAt: new Date("2026-08-12T00:00:02.000Z"),
      },
    };

    render(
      <AiProviderCardContent
        data={{ ...control(null), revisions: [inconclusive] }}
        savedRevision={queued}
        message="Provider test queued."
        mutations={mutations() as never}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "The provider test could not be completed because the provider is temporarily unavailable. Retry the test.",
    );
  });

  it("shows provider lanes without obsolete feature diagnostics", () => {
    const candidate: AiProviderConfigurationRead = {
      ...revision("draft"),
      testResult: {
        status: "inconclusive",
        generation: {
          status: "passed",
          capabilities: [{ capability: "planner_tool_call", status: "passed" }],
        },
        embeddings: { status: "passed", capabilities: [] },
        testedAt: new Date("2026-08-13T08:42:34.000Z"),
      },
      latestExecution: {
        id: "22222222-2222-4222-8222-222222222222",
        testSuiteVersion: "provider-test-v1",
        state: "completed",
        outcome: "inconclusive",
        failureCode: null,
        checks: [],
        requestedAt: new Date("2026-08-13T08:42:30.000Z"),
        startedAt: new Date("2026-08-13T08:42:31.000Z"),
        completedAt: new Date("2026-08-13T08:42:34.000Z"),
      },
    };

    render(
      <AiProviderCardContent
        data={{ ...control(null), revisions: [candidate] }}
        savedRevision={candidate}
        message={null}
        mutations={mutations() as never}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByTestId("ai-capability-results")).toHaveTextContent(
      "Generation: Passed",
    );
    expect(screen.getByTestId("ai-capability-results")).toHaveTextContent(
      "Embeddings: Same connection as Generation · Passed",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "The provider test could not be completed because the provider is temporarily unavailable. Retry the test.",
    );
    expect(
      screen.queryByText("The provider capability test failed."),
    ).toBeNull();
  });

  it("attributes tool generation failure to the planner instead of authentication", () => {
    const failed: AiProviderConfigurationRead = {
      ...revision("failed"),
      testResult: {
        status: "failed",
        generation: {
          status: "failed",
          capabilities: [
            {
              capability: "planner_tool_call",
              status: "failed",
              failureCode: "tool_use_failed",
            },
          ],
        },
        embeddings: { status: "passed", capabilities: [] },
        testedAt: new Date("2026-08-13T08:57:54.000Z"),
      },
      latestExecution: {
        id: "22222222-2222-4222-8222-222222222222",
        testSuiteVersion: "provider-test-v1",
        state: "completed",
        outcome: "incompatible",
        failureCode: "tool_use_failed",
        checks: [],
        requestedAt: new Date("2026-08-13T08:57:50.000Z"),
        startedAt: new Date("2026-08-13T08:57:51.000Z"),
        completedAt: new Date("2026-08-13T08:57:54.000Z"),
      },
    };

    render(
      <AiProviderCardContent
        data={{ ...control(null), revisions: [failed] }}
        savedRevision={failed}
        message={null}
        mutations={mutations() as never}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Generation · Planner tool call: The model did not produce a valid tool call after retry.",
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("Authentication");
  });

  it("submits the selected normalized reasoning mode", () => {
    const onSave = vi.fn<(draft: AiProviderDraft) => void>();
    render(
      <AiProviderCardContent
        data={control(null)}
        savedRevision={null}
        message={null}
        mutations={mutations() as never}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Generation reasoning"), {
      target: { value: "custom" },
    });
    fireEvent.change(screen.getByLabelText("Custom reasoning value"), {
      target: { value: "deep" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    const savedDraft = onSave.mock.calls[0]?.[0];
    expect(savedDraft?.generation.reasoningMode).toBe("custom");
    expect(savedDraft?.generation.reasoningCustomValue).toBe("deep");
  });

  it("explains when custom reasoning has no value", () => {
    render(
      <AiProviderCardContent
        data={control(null)}
        savedRevision={null}
        message={null}
        mutations={mutations() as never}
        onSave={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Generation reasoning"), {
      target: { value: "custom" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a custom reasoning value.",
    );
  });

  it("reveals a separate embedding connection with role-filtered profiles", () => {
    const onSave = vi.fn<(draft: AiProviderDraft) => void>();
    render(
      <AiProviderCardContent
        data={control(null)}
        savedRevision={null}
        message={null}
        mutations={mutations() as never}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Embedding connection mode"), {
      target: { value: "separate" },
    });
    const embeddingProfile = screen.getByLabelText(
      "Embeddings provider profile",
    );
    const embeddingProfiles = Array.from(
      embeddingProfile.querySelectorAll("option"),
    ).map(({ value }) => value);
    expect(embeddingProfiles).not.toContain("groq");
    expect(embeddingProfiles).toContain("jina");
    fireEvent.change(screen.getByLabelText("Embedding model"), {
      target: { value: "jina-embeddings-v3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        embeddings: {
          mode: "separate",
          profile: "mistral",
          model: "jina-embeddings-v3",
        },
      }),
    );
  });
});

describe("AiProviderRetainedRevisions", () => {
  it("confirms discard and exposes pending state for disposable attempts", () => {
    const active = revision("active");
    const failed = revision("failed");
    const onDiscard = vi.fn();

    const view = render(
      <AiProviderRetainedRevisions
        revisions={[active, failed]}
        activeRevisionId={active.id}
        busy={false}
        restorePendingRevisionId={null}
        discardPendingRevisionId={null}
        onRestore={vi.fn()}
        onDiscard={onDiscard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: /^Discard$/,
      }),
    );
    expect(onDiscard).toHaveBeenCalledWith(failed.id);

    view.rerender(
      <AiProviderRetainedRevisions
        revisions={[active, failed]}
        activeRevisionId={active.id}
        busy
        restorePendingRevisionId={null}
        discardPendingRevisionId={failed.id}
        onRestore={vi.fn()}
        onDiscard={onDiscard}
      />,
    );
    expect(screen.getByRole("button", { name: "Discarding…" })).toBeDisabled();
  });

  it("keeps restore for retained revisions and hides discard", () => {
    const active = revision("active");
    const superseded = revision("superseded");
    const onRestore = vi.fn();
    render(
      <AiProviderRetainedRevisions
        revisions={[active, superseded]}
        activeRevisionId={active.id}
        busy={false}
        restorePendingRevisionId={null}
        discardPendingRevisionId={null}
        onRestore={onRestore}
        onDiscard={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Restore" }));
    expect(onRestore).toHaveBeenCalledWith(superseded.id);
    expect(
      screen.queryByRole("button", { name: "Discard" }),
    ).not.toBeInTheDocument();
  });

  it("limits pending feedback to the revision being changed", () => {
    const active = revision("active");
    const failed = revision("failed");
    const other = { ...revision("failed"), id: "other-revision" };
    render(
      <AiProviderRetainedRevisions
        revisions={[active, failed, other]}
        activeRevisionId={active.id}
        busy
        restorePendingRevisionId={null}
        discardPendingRevisionId={failed.id}
        onRestore={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Discarding…" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Discard" })).toHaveLength(1);
  });
});
