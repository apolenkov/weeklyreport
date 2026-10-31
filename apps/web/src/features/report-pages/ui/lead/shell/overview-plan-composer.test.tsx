import { render } from "@testing-library/react";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import type {
  StatusOverviewItem,
  StatusOverviewModel,
} from "../../../../report-sections";
import {
  createOverviewPlanState,
  type OverviewPlanState,
} from "./overview-plan-command";
import { OverviewPlanComposer } from "./overview-plan-composer";
import type { ComposerProps } from "./overview-plan-composer-fields";
import type { ReadyEditor } from "./use-overview-controller";

type SectionItem = ReportSectionReadModel["items"][number];

const ITEM_TEXT = "Ship the export";

const editor = {
  generation: "generation-1",
  draft: {
    section: {
      projects: [],
      activities: [],
      items: [],
    } as unknown as ReportSectionReadModel,
  },
  view: { viewModel: { products: [], activityOptions: [] } },
} as unknown as ReadyEditor;

const model = { units: [] } as unknown as StatusOverviewModel;

const item = {
  key: "current:item-1",
  recordId: "item-1",
  source: "current",
  editTarget: null,
  stableId: "stable-1",
  text: ITEM_TEXT,
  stageNames: [],
  canResolve: true,
  canRestore: false,
} as unknown as StatusOverviewItem;

const raw = {
  id: "item-1",
  stableId: "stable-1",
  type: "current",
  text: ITEM_TEXT,
  stageNames: [],
  projectId: null,
  activityId: null,
} as unknown as SectionItem;

function openState(): OverviewPlanState {
  return createOverviewPlanState(editor, model, item, {
    raw,
    source: { kind: "current", recordId: "item-1" },
    mode: "resolve",
  });
}

function composerProps(
  state: OverviewPlanState,
  overrides: Partial<ComposerProps> = {},
): ComposerProps {
  return {
    state,
    pending: false,
    blockedReason: null,
    recoveryReason: null,
    error: null,
    onChoose: vi.fn(),
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

// Reports whether the composer's beforeunload listener asks for confirmation.
function unloadPrevented(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("OverviewPlanComposer unload guard", () => {
  it("does not prompt on unload while the composer is pristine", () => {
    const state = openState();
    render(<OverviewPlanComposer {...composerProps(state)} />);

    expect(unloadPrevented()).toBe(false);
  });

  it("does not prompt on unload after only an outcome is chosen", () => {
    const state = openState();
    render(
      <OverviewPlanComposer
        {...composerProps({
          ...state,
          fields: { ...state.fields, outcome: "done" },
        })}
      />,
    );

    expect(unloadPrevented()).toBe(false);
  });

  it("prompts on unload once input beyond the outcome is edited", () => {
    const state = openState();
    const { rerender } = render(
      <OverviewPlanComposer {...composerProps(state)} />,
    );

    rerender(
      <OverviewPlanComposer
        {...composerProps({
          ...state,
          fields: { ...state.fields, reason: "Customer request" },
        })}
      />,
    );

    expect(unloadPrevented()).toBe(true);
  });

  it("stops prompting on unload after the input is restored to its opened values", () => {
    const state = openState();
    const { rerender } = render(
      <OverviewPlanComposer
        {...composerProps({
          ...state,
          fields: { ...state.fields, reason: "Customer request" },
        })}
      />,
    );
    expect(unloadPrevented()).toBe(true);

    rerender(<OverviewPlanComposer {...composerProps(state)} />);

    expect(unloadPrevented()).toBe(false);
  });
});
