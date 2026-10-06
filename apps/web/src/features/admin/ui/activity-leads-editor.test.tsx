import type { ProjectActivity } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import {
  type CapturedMutation,
  createMockTRPC,
} from "../../../test-utils/mock-trpc";
import type { AdminUserView } from "../model/admin-types";
import { ActivityLeadsEditor } from "./activity-leads-editor";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_GROUP_ID = "22222222-2222-4222-8222-222222222222";
const ACTIVE_LEAD_ID = "33333333-3333-4333-8333-333333333333";
const INACTIVE_LEAD_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_GROUP_LEAD_ID = "55555555-5555-4555-8555-555555555555";
const ACTIVITY_ID = "66666666-6666-4666-8666-666666666666";

const activeLead: AdminUserView = {
  id: ACTIVE_LEAD_ID,
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

const inactiveLead: AdminUserView = {
  ...activeLead,
  id: INACTIVE_LEAD_ID,
  name: "Carol",
  lastName: "Carol",
  email: "carol@example.com",
  isActive: false,
};

const otherGroupLead: AdminUserView = {
  ...activeLead,
  id: OTHER_GROUP_LEAD_ID,
  name: "Bob",
  lastName: "Bob",
  email: "bob@example.com",
  groupId: OTHER_GROUP_ID,
  department: "Data",
};

const activity: ProjectActivity = {
  id: ACTIVITY_ID,
  name: "Onboarding Revamp",
  groupId: GROUP_ID,
  linkedProducts: [],
  jiraAccounts: [],
  archived: false,
  leadIds: [],
};

function renderEditor(opts?: {
  activity?: ProjectActivity;
  users?: AdminUserView[];
}): { captured: Record<string, CapturedMutation> } {
  const { proxy, captured } = createMockTRPC([
    { path: ["projectActivity", "list"] },
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
    <ActivityLeadsEditor
      activity={opts?.activity ?? activity}
      users={opts?.users ?? [activeLead]}
    />,
    { wrapper: Wrapper },
  );

  return { captured };
}

describe("ActivityLeadsEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps a deactivated attached lead listed and lets it detach", async () => {
    const user = userEvent.setup();
    const { captured } = renderEditor({
      activity: { ...activity, leadIds: [INACTIVE_LEAD_ID] },
      users: [inactiveLead],
    });

    const checkbox = screen.getByLabelText(
      "Toggle Carol L. on Onboarding Revamp",
    );
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeEnabled();
    expect(screen.getByText("Inactive")).toBeInTheDocument();

    await user.click(checkbox);

    await waitFor(() => {
      expect(captured["projectActivity.detachLead"]?.calls).toEqual([
        { activityId: ACTIVITY_ID, leadId: INACTIVE_LEAD_ID },
      ]);
    });
    expect(captured["projectActivity.attachLead"]?.calls).toEqual([]);
  });

  it("does not list an inactive lead that was never attached", () => {
    renderEditor({ users: [inactiveLead] });

    expect(
      screen.getByText(/No active leads yet\. Create one/),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Toggle Carol L. on Onboarding Revamp"),
    ).not.toBeInTheDocument();
  });

  it("keeps an active lead from another reporting group locked", () => {
    const { captured } = renderEditor({ users: [otherGroupLead] });

    const locked = screen.getByLabelText("Toggle Bob L. on Onboarding Revamp");
    expect(locked).toBeDisabled();
    expect(screen.getByText("Belongs to Data")).toBeInTheDocument();
    expect(captured["projectActivity.attachLead"]?.calls).toEqual([]);
  });
});
