import type { ProjectActivity } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  type CapturedMutation,
  createMockTRPC,
} from "../../../test-utils/mock-trpc";
import type {
  AdminGroupView,
  AdminProductView,
  AdminUserView,
} from "../model/admin-types";
import { ActivitiesTab } from "./activities-tab";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("../../../shared/ui/dialogs/confirm-delete-dialog", () => ({
  ConfirmDeleteDialog: ({
    open,
    title,
    onConfirm,
  }: {
    readonly open: boolean;
    readonly title: string;
    readonly onConfirm: () => void;
  }) =>
    open ? (
      <div data-testid="confirm-archive-dialog">
        <span>{title}</span>
        <button type="button" onClick={onConfirm}>
          Confirm archive
        </button>
      </div>
    ) : null,
}));

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_GROUP_ID = "22222222-2222-4222-8222-222222222222";
const LEAD_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_LEAD_ID = "44444444-4444-4444-8444-444444444444";
const PRODUCT_ID = "55555555-5555-4555-8555-555555555555";
const ACTIVITY_ID = "66666666-6666-4666-8666-666666666666";

const group: AdminGroupView = {
  id: GROUP_ID,
  name: "Platform",
  description: null,
  archived: false,
  headUserId: null,
};

const otherGroup: AdminGroupView = {
  ...group,
  id: OTHER_GROUP_ID,
  name: "Data",
};

const lead: AdminUserView = {
  id: LEAD_ID,
  name: "Alice",
  lastName: "Alice",
  firstName: "Lead",
  middleName: null,
  position: null,
  email: "alice@example.com",
  role: "lead",
  groupId: GROUP_ID,
  department: "Platform",
  isActive: true,
};

const otherGroupLead: AdminUserView = {
  ...lead,
  id: OTHER_LEAD_ID,
  name: "Bob",
  email: "bob@example.com",
  groupId: OTHER_GROUP_ID,
  department: "Data",
};

const product: AdminProductView = {
  id: PRODUCT_ID,
  name: "Checkout",
  leadOwnerId: LEAD_ID,
  stages: [],
  status: "active",
};

const activity: ProjectActivity = {
  id: ACTIVITY_ID,
  name: "Onboarding Revamp",
  groupId: GROUP_ID,
  linkedProducts: [{ productId: PRODUCT_ID, productName: "Checkout" }],
  jiraAccounts: ["ACME"],
  archived: false,
  leadIds: [],
};

function renderTab(opts?: {
  activities?: ProjectActivity[];
  users?: AdminUserView[];
}): { captured: Record<string, CapturedMutation> } {
  const { proxy, captured } = createMockTRPC([
    {
      path: ["projectActivity", "list"],
      query: opts?.activities ?? [activity],
    },
    { path: ["projectActivity", "create"], mutation: true },
    { path: ["projectActivity", "update"], mutation: true },
    { path: ["projectActivity", "archive"], mutation: true },
    { path: ["projectActivity", "attachLead"], mutation: true },
    { path: ["projectActivity", "detachLead"], mutation: true },
  ]);

  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  render(
    <ActivitiesTab
      groups={[group, otherGroup]}
      users={opts?.users ?? [lead, otherGroupLead]}
      products={[product]}
    />,
    { wrapper: Wrapper },
  );

  return { captured };
}

describe("ActivitiesTab — rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { leadIds: [], expectedCount: "0 leads" },
    { leadIds: [LEAD_ID], expectedCount: "1 lead" },
    { leadIds: [LEAD_ID, OTHER_LEAD_ID], expectedCount: "2 leads" },
  ])(
    "lists each activity with its group, linked products and lead count ($expectedCount)",
    async ({ leadIds, expectedCount }) => {
      renderTab({ activities: [{ ...activity, leadIds }] });

      expect(await screen.findByText("Onboarding Revamp")).toBeInTheDocument();
      expect(screen.getByText(/Group: Platform/)).toBeInTheDocument();
      expect(
        screen.getByText(/Linked products: Checkout · Jira: ACME/),
      ).toBeInTheDocument();
      expect(screen.getByText(expectedCount)).toBeInTheDocument();
    },
  );

  it("separates archived activities and offers Restore for them", async () => {
    renderTab({
      activities: [activity, { ...activity, id: "arch", archived: true }],
    });

    expect(await screen.findByText("Archived (1)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Restore Onboarding Revamp" }),
    ).toBeInTheDocument();
  });

  it("filters the list by name", async () => {
    const user = userEvent.setup();
    renderTab({
      activities: [activity, { ...activity, id: "other", name: "Migration" }],
    });

    await screen.findByText("Onboarding Revamp");
    await user.type(
      screen.getByLabelText("Filter activities by name"),
      "migra",
    );

    expect(screen.queryByText("Onboarding Revamp")).not.toBeInTheDocument();
    expect(screen.getByText("Migration")).toBeInTheDocument();
  });
});

describe("ActivitiesTab — create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the typed name, picked group, linked products and split Jira accounts", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await screen.findByText("Onboarding Revamp");
    await user.click(screen.getByRole("button", { name: "Add new activity" }));

    await user.type(screen.getByLabelText("Activity Name"), "Compliance Audit");
    await user.selectOptions(
      screen.getByLabelText("Reporting Group"),
      GROUP_ID,
    );
    await user.click(screen.getByLabelText("Link Checkout"));
    await user.type(screen.getByLabelText("Jira Accounts"), " ACME , PLAT ,");

    await user.click(screen.getByRole("button", { name: "Add Activity" }));

    await waitFor(() => {
      expect(captured["projectActivity.create"]?.calls).toEqual([
        {
          name: "Compliance Audit",
          groupId: GROUP_ID,
          linkedProductIds: [PRODUCT_ID],
          jiraAccounts: ["ACME", "PLAT"],
        },
      ]);
    });
  });

  it("keeps Save disabled until the activity has both a name and a chosen group", async () => {
    const user = userEvent.setup();
    renderTab();

    await screen.findByText("Onboarding Revamp");
    await user.click(screen.getByRole("button", { name: "Add new activity" }));

    const save = screen.getByRole("button", { name: "Add Activity" });
    // No silent preselection of the first group; both fields are explicit.
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText("Activity Name"), "X");
    expect(save).toBeDisabled();

    await user.selectOptions(
      screen.getByLabelText("Reporting Group"),
      GROUP_ID,
    );
    expect(save).toBeEnabled();
  });

  it("keeps the dialog open on Escape and backdrop click while Save is pending", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab({ activities: [] });
    captured["projectActivity.create"]?.mutationFn.mockReturnValue(
      new Promise<never>(() => undefined),
    );

    await screen.findByRole("button", { name: "Add new activity" });
    await user.click(screen.getByRole("button", { name: "Add new activity" }));
    await user.type(screen.getByLabelText("Activity Name"), "Audit");
    await user.selectOptions(
      screen.getByLabelText("Reporting Group"),
      GROUP_ID,
    );
    await user.click(screen.getByRole("button", { name: "Add Activity" }));

    await screen.findByRole("button", { name: "Saving…" });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("presentation"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("locks the submitted draft while pending and unlocks it unchanged after failure", async () => {
    const deferred = Promise.withResolvers<unknown>();
    const { captured } = renderTab({ activities: [] });
    const create = expectDefined(captured["projectActivity.create"]);
    create.mutationFn.mockReturnValue(deferred.promise);
    const user = userEvent.setup();

    await screen.findByRole("button", { name: "Add new activity" });
    await user.click(screen.getByRole("button", { name: "Add new activity" }));
    const name = screen.getByLabelText("Activity Name");
    await user.type(name, "Audit");
    await user.selectOptions(
      screen.getByLabelText("Reporting Group"),
      GROUP_ID,
    );
    await user.click(screen.getByRole("button", { name: "Add Activity" }));

    await screen.findByRole("button", { name: "Saving…" });
    expect(name).toBeDisabled();
    await user.click(name);
    await user.keyboard("Unsent replacement");
    expect(name).toHaveValue("Audit");
    expect(create.calls[0]).toMatchObject({ name: "Audit" });

    act(() => deferred.reject(new Error("save failed")));
    await waitFor(() => expect(name).toBeEnabled());
    expect(name).toHaveValue("Audit");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("ActivitiesTab — edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefills the dialog and sends the activity id with the changed fields", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await screen.findByText("Onboarding Revamp");
    await user.click(
      screen.getByRole("button", { name: "Edit Onboarding Revamp" }),
    );

    expect(screen.getByLabelText("Activity Name")).toHaveValue(
      "Onboarding Revamp",
    );
    expect(screen.getByLabelText("Link Checkout")).toBeChecked();

    // Clearing every product link must reconcile to an empty set, not a no-op.
    await user.click(screen.getByLabelText("Link Checkout"));
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(captured["projectActivity.update"]?.calls).toEqual([
        {
          id: ACTIVITY_ID,
          name: "Onboarding Revamp",
          groupId: GROUP_ID,
          linkedProductIds: [],
          jiraAccounts: ["ACME"],
        },
      ]);
    });
  });

  it("locks the group picker while leads are attached", async () => {
    const user = userEvent.setup();
    renderTab({ activities: [{ ...activity, leadIds: [LEAD_ID] }] });

    await screen.findByText("Onboarding Revamp");
    await user.click(
      screen.getByRole("button", { name: "Edit Onboarding Revamp" }),
    );

    expect(screen.getByLabelText("Reporting Group")).toBeDisabled();
    expect(
      screen.getByText(
        "Detach all leads before moving the activity to another group.",
      ),
    ).toBeInTheDocument();
  });

  it("leaves the group picker editable when no lead is attached", async () => {
    const user = userEvent.setup();
    renderTab();

    await screen.findByText("Onboarding Revamp");
    await user.click(
      screen.getByRole("button", { name: "Edit Onboarding Revamp" }),
    );

    expect(screen.getByLabelText("Reporting Group")).toBeEnabled();
  });
});

describe("ActivitiesTab — focus management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("focuses the name field on open and restores the trigger after Escape", async () => {
    const user = userEvent.setup();
    renderTab();
    const addButton = await screen.findByRole("button", {
      name: "Add new activity",
    });
    addButton.focus();

    await user.click(addButton);
    expect(screen.getByLabelText("Activity Name")).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(addButton).toHaveFocus();
  });
});

describe("ActivitiesTab — archive and restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("archives only after the confirmation is accepted", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await screen.findByText("Onboarding Revamp");
    await user.click(
      screen.getByRole("button", { name: "Archive Onboarding Revamp" }),
    );

    expect(captured["projectActivity.archive"]?.calls).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Confirm archive" }));

    await waitFor(() => {
      expect(captured["projectActivity.archive"]?.calls).toEqual([
        { id: ACTIVITY_ID, archived: true },
      ]);
    });
  });

  it("restores an archived activity through the same mutation", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab({
      activities: [{ ...activity, archived: true }],
    });

    await user.click(
      await screen.findByRole("button", {
        name: "Restore Onboarding Revamp",
      }),
    );

    await waitFor(() => {
      expect(captured["projectActivity.archive"]?.calls).toEqual([
        { id: ACTIVITY_ID, archived: false },
      ]);
    });
  });
});

describe("ActivitiesTab — lead attachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function expandLeadEditor(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      await screen.findByRole("button", {
        name: "Expand lead attachments for Onboarding Revamp",
      }),
    );
  }

  it("links the activity disclosure to its labelled lead region", async () => {
    renderTab();

    const toggle = await screen.findByRole("button", {
      name: "Expand lead attachments for Onboarding Revamp",
    });
    const panelId = toggle.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId ?? "");
    expect(panel).toHaveAttribute("role", "region");
    expect(panel).toHaveAttribute("aria-labelledby", toggle.id);
    expect(panel).toHaveAttribute("aria-hidden", "true");
  });

  it("attaches a same-group lead", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await expandLeadEditor(user);
    await user.click(
      screen.getByLabelText("Toggle Alice on Onboarding Revamp"),
    );

    await waitFor(() => {
      expect(captured["projectActivity.attachLead"]?.calls).toEqual([
        { activityId: ACTIVITY_ID, leadId: LEAD_ID },
      ]);
    });
  });

  it("detaches an already-attached lead", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab({
      activities: [{ ...activity, leadIds: [LEAD_ID] }],
    });

    await expandLeadEditor(user);
    const checkbox = screen.getByLabelText("Toggle Alice on Onboarding Revamp");
    expect(checkbox).toBeChecked();

    await user.click(checkbox);

    await waitFor(() => {
      expect(captured["projectActivity.detachLead"]?.calls).toEqual([
        { activityId: ACTIVITY_ID, leadId: LEAD_ID },
      ]);
    });
  });

  it("locks a lead from another reporting group and explains why", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await expandLeadEditor(user);

    const locked = screen.getByLabelText("Toggle Bob on Onboarding Revamp");
    expect(locked).toBeDisabled();
    expect(screen.getByText("Belongs to Data")).toBeInTheDocument();
    expect(captured["projectActivity.attachLead"]?.calls).toEqual([]);
  });
});
