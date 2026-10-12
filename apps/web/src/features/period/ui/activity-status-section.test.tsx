import type { TrafficLightStatus } from "@customreport/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import type { LeadActivityCard } from "../../report-sections";
import { ActivityStatusSection } from "./activity-status-section";

const ACTIVITY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACTIVITY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeCard(overrides: Partial<LeadActivityCard>): LeadActivityCard {
  const titleOverride = overrides.titleOverride ?? null;
  const activityName = overrides.activityName ?? "Jira triage duty";
  return {
    activityId: ACTIVITY_A,
    activityName,
    titleOverride,
    displayTitle: titleOverride?.trim() || activityName,
    note: null,
    status: "green",
    derivedStatus: null,
    alarmFloor: null,
    linkedProducts: [],
    ...overrides,
  };
}

const activities: LeadActivityCard[] = [
  makeCard({
    activityId: ACTIVITY_A,
    activityName: "Jira triage duty",
    status: "green",
    linkedProducts: [{ productId: "p1", productName: "CRM" }],
  }),
  makeCard({
    activityId: ACTIVITY_B,
    activityName: "Ops rotation",
    status: "red",
  }),
];

function renderSection(
  cards: readonly LeadActivityCard[],
  opts?: {
    readOnly?: boolean;
    onStatusChange?: (activityId: string, status: TrafficLightStatus) => void;
    onRaiseRequiresRisk?: (
      activityId: string,
      severity: "at-risk" | "blocked",
    ) => void;
    onTitleChange?: (activityId: string, titleOverride: string | null) => void;
    onDescriptionChange?: (activityId: string, note: string | null) => void;
  },
) {
  return render(
    <ActivityStatusSection
      activities={cards}
      readOnly={opts?.readOnly ?? false}
      onStatusChange={opts?.onStatusChange ?? vi.fn()}
      onRaiseRequiresRisk={opts?.onRaiseRequiresRisk ?? vi.fn()}
      onTitleChange={opts?.onTitleChange ?? vi.fn()}
      onDescriptionChange={opts?.onDescriptionChange ?? vi.fn()}
    />,
  );
}

function pillsOf(name: string): HTMLButtonElement[] {
  const group = screen.getByRole("group", { name: `Status for ${name}` });
  return [...group.querySelectorAll("button")];
}

describe("ActivityStatusSection", () => {
  // The card is status-only — records render in the main record sections
  // under the activity's lane.
  it("renders one status-only card per activity with linked products", () => {
    renderSection(activities);

    expect(screen.getByText("Jira triage duty")).toBeInTheDocument();
    expect(screen.getByText("Ops rotation")).toBeInTheDocument();
    expect(screen.getByText("Products: CRM")).toBeInTheDocument();
    expect(screen.getAllByRole("group")).toHaveLength(2);
    expect(screen.queryByText(/add/i)).toBeNull();
    // No record content leaks into the card.
    expect(screen.queryByText("Current")).toBeNull();
    expect(screen.queryByText("Risks & Blockers")).toBeNull();
  });

  it("renders nothing when the author has no attached activities", () => {
    const { container } = renderSection([]);
    expect(container).toBeEmptyDOMElement();
  });

  it("routes an unbacked At Risk click to risk creation, not a status write", async () => {
    const onStatusChange = vi.fn();
    const onRaiseRequiresRisk = vi.fn();
    const user = userEvent.setup();
    renderSection(activities, { onStatusChange, onRaiseRequiresRisk });

    const [onTrack, atRisk] = pillsOf("Jira triage duty");
    expect(onTrack).toHaveAttribute("aria-pressed", "true");

    await user.click(expectDefined(atRisk));
    expect(onStatusChange).not.toHaveBeenCalled();
    expect(onRaiseRequiresRisk).toHaveBeenCalledWith(ACTIVITY_A, "at-risk");
  });

  it("routes an unbacked Blocked click to blocker creation with severity blocked", async () => {
    const onRaiseRequiresRisk = vi.fn();
    const user = userEvent.setup();
    renderSection([makeCard({})], { onRaiseRequiresRisk });

    const [, , blocked] = pillsOf("Jira triage duty");
    await user.click(expectDefined(blocked));
    expect(onRaiseRequiresRisk).toHaveBeenCalledWith(ACTIVITY_A, "blocked");
  });

  it("a Blocked click on an at-risk-floored pill still needs a blocker", async () => {
    // A covering at-risk risk backs yellow but not red — red needs a blocker.
    const onStatusChange = vi.fn();
    const onRaiseRequiresRisk = vi.fn();
    const user = userEvent.setup();
    renderSection(
      [makeCard({ alarmFloor: "yellow", derivedStatus: "yellow" })],
      { onStatusChange, onRaiseRequiresRisk },
    );

    const [, , blocked] = pillsOf("Jira triage duty");
    await user.click(expectDefined(blocked));
    expect(onStatusChange).not.toHaveBeenCalled();
    expect(onRaiseRequiresRisk).toHaveBeenCalledWith(ACTIVITY_A, "blocked");
  });

  it("an At Risk click at the yellow floor neither writes nor opens creation", async () => {
    // The pill already shows the floor; clicking it must not overwrite the
    // stored lower choice (clearing the risk restores it) and the severity is
    // already backed, so no creation either.
    const onStatusChange = vi.fn();
    const onRaiseRequiresRisk = vi.fn();
    const user = userEvent.setup();
    renderSection(
      [makeCard({ alarmFloor: "yellow", derivedStatus: "yellow" })],
      { onStatusChange, onRaiseRequiresRisk },
    );

    const [, atRisk] = pillsOf("Jira triage duty");
    await user.click(expectDefined(atRisk));
    expect(onStatusChange).not.toHaveBeenCalled();
    expect(onRaiseRequiresRisk).not.toHaveBeenCalled();
  });

  it("renders the floored pill and refuses a manual lower below the floor", async () => {
    const onStatusChange = vi.fn();
    const user = userEvent.setup();
    // Stored green but a covering blocker floors the pill to red (alarmFloor).
    renderSection(
      [
        makeCard({
          status: "green",
          alarmFloor: "red",
          derivedStatus: "red",
        }),
      ],
      { onStatusChange },
    );

    const [onTrack, , blocked] = pillsOf("Jira triage duty");
    // The floor (red) is shown pressed, not the stored green.
    expect(blocked).toHaveAttribute("aria-pressed", "true");
    expect(onTrack).toHaveAttribute("aria-pressed", "false");

    await user.click(expectDefined(onTrack));
    expect(onStatusChange).not.toHaveBeenCalled();
    expect(
      screen.getByText(/resolve the covering risk\/blocker first/i),
    ).toBeInTheDocument();
  });

  it("keeps the refusal notice tied to the floor observed at pick time", async () => {
    const user = userEvent.setup();
    const floored = makeCard({
      status: "green",
      alarmFloor: "red",
      derivedStatus: "red",
    });
    const handlers = {
      readOnly: false,
      onStatusChange: vi.fn(),
      onRaiseRequiresRisk: vi.fn(),
      onTitleChange: vi.fn(),
      onDescriptionChange: vi.fn(),
    };
    const { rerender } = render(
      <ActivityStatusSection activities={[floored]} {...handlers} />,
    );

    const [onTrack] = pillsOf("Jira triage duty");
    await user.click(expectDefined(onTrack));
    expect(
      screen.getByText(/resolve the covering risk\/blocker first/i),
    ).toBeInTheDocument();

    // A rerender with the same floor keeps the notice.
    rerender(
      <ActivityStatusSection activities={[{ ...floored }]} {...handlers} />,
    );
    expect(
      screen.getByText(/resolve the covering risk\/blocker first/i),
    ).toBeInTheDocument();

    // The covering risk is resolved elsewhere: the floor lifts and the stale
    // explanation goes with it — no second pick is needed.
    rerender(
      <ActivityStatusSection
        activities={[{ ...floored, alarmFloor: null }]}
        {...handlers}
      />,
    );
    expect(
      screen.queryByText(/resolve the covering risk\/blocker first/i),
    ).toBeNull();

    // A floor returning without a new pick must not resurrect the old refusal.
    rerender(<ActivityStatusSection activities={[floored]} {...handlers} />);
    expect(
      screen.queryByText(/resolve the covering risk\/blocker first/i),
    ).toBeNull();

    // Only a fresh refused pick raises the notice again.
    await user.click(expectDefined(pillsOf("Jira triage duty")[0]));
    expect(
      screen.getByText(/resolve the covering risk\/blocker first/i),
    ).toBeInTheDocument();
  });

  it("lets the lead lower a stored raised status when no floor holds it", async () => {
    const onStatusChange = vi.fn();
    const onRaiseRequiresRisk = vi.fn();
    const user = userEvent.setup();
    // With no covering risk, alarmFloor is null and lowering a stored red value
    // to green stays a direct write.
    renderSection(
      [
        makeCard({
          status: "red",
          alarmFloor: null,
          derivedStatus: "red",
        }),
      ],
      { onStatusChange, onRaiseRequiresRisk },
    );

    const [onTrack] = pillsOf("Jira triage duty");
    await user.click(expectDefined(onTrack));
    expect(onStatusChange).toHaveBeenCalledWith(ACTIVITY_A, "green");
    expect(onRaiseRequiresRisk).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/resolve the covering risk\/blocker first/i),
    ).toBeNull();
  });

  it("disables every picker in read-only mode", () => {
    const onStatusChange = vi.fn();
    const onRaiseRequiresRisk = vi.fn();
    renderSection(activities, {
      readOnly: true,
      onStatusChange,
      onRaiseRequiresRisk,
    });

    const buttons = screen.getAllByRole("button");
    expect(buttons.every((button) => button.hasAttribute("disabled"))).toBe(
      true,
    );
  });
});

describe("ActivityStatusSection weekly title and description", () => {
  it("shows the effective override title and keeps the catalogue identity", () => {
    renderSection([makeCard({ titleOverride: "Weekly duty" })]);

    expect(screen.getByText("Weekly duty")).toBeInTheDocument();
    expect(
      screen.getByText("Catalogue activity: Jira triage duty"),
    ).toBeInTheDocument();
  });

  it("emits title and description changes for the activity", async () => {
    const onTitleChange = vi.fn();
    const onDescriptionChange = vi.fn();
    const user = userEvent.setup();
    renderSection([makeCard({})], { onTitleChange, onDescriptionChange });

    await user.type(screen.getByTestId(`activity-title-${ACTIVITY_A}`), "W");
    expect(onTitleChange).toHaveBeenLastCalledWith(ACTIVITY_A, "W");

    await user.type(
      screen.getByTestId(`activity-description-${ACTIVITY_A}`),
      "D",
    );
    expect(onDescriptionChange).toHaveBeenLastCalledWith(ACTIVITY_A, "D");
  });

  it("resets the title to the catalogue name via the reset control", async () => {
    const onTitleChange = vi.fn();
    const user = userEvent.setup();
    renderSection([makeCard({ titleOverride: "Weekly duty" })], {
      onTitleChange,
    });

    await user.click(screen.getByTestId(`activity-title-reset-${ACTIVITY_A}`));
    expect(onTitleChange).toHaveBeenCalledWith(ACTIVITY_A, null);
  });

  it("disables the weekly overrides in read-only mode", () => {
    renderSection([makeCard({ titleOverride: "Weekly duty" })], {
      readOnly: true,
    });

    expect(screen.getByTestId(`activity-title-${ACTIVITY_A}`)).toBeDisabled();
    expect(
      screen.getByTestId(`activity-description-${ACTIVITY_A}`),
    ).toBeDisabled();
  });
});
