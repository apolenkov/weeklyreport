import type { ProjectActivity } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  ProjectActivityDomainError,
  ProjectActivityNotFoundError,
  type ProjectActivityRepository,
  ProjectActivityService,
} from "./project-activity.service";

const GROUP_A = "11111111-1111-4111-8111-111111111111";
const GROUP_B = "22222222-2222-4222-8222-222222222222";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const LEAD_IN_A = "44444444-4444-4444-8444-444444444444";
const LEAD_IN_B = "55555555-5555-4555-8555-555555555555";
const HEAD_IN_A = "66666666-6666-4666-8666-666666666666";

interface Fixture {
  activities?: ProjectActivity[];
  groups?: string[];
  products?: string[];
  users?: Record<string, { role: string; reportingGroupId: string | null }>;
}

function makeActivity(
  overrides: Partial<ProjectActivity> = {},
): ProjectActivity {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Jira triage duty",
    groupId: GROUP_A,
    linkedProducts: [],
    jiraAccounts: [],
    archived: false,
    leadIds: [],
    ...overrides,
  };
}

// The admin CRUD reconciles `linkedProductIds` into join rows; the in-memory
// fake mirrors that by projecting each id onto a label-only linkedProducts entry.
const toLinkedProducts = (linkedProductIds: readonly string[]) =>
  linkedProductIds.map((productId) => ({ productId, productName: productId }));

// In-memory repository: the service owns reference/group validation, so the
// fake only answers lookups and records the attach/detach calls.
function createRepository(fixture: Fixture = {}) {
  const activities = new Map(
    (fixture.activities ?? [makeActivity()]).map((a) => [a.id, a] as const),
  );
  const attached: { activityId: string; leadId: string }[] = [];
  const detached: { activityId: string; leadId: string }[] = [];

  const repository: ProjectActivityRepository = {
    // eslint-disable-next-line @typescript-eslint/require-await -- implements the async repository contract; no awaitable work in the stub
    async list() {
      return [...activities.values()];
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- implements the async repository contract; no awaitable work in the stub
    async findById(id) {
      return activities.get(id) ?? null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- implements the async repository contract; no awaitable work in the stub
    async create({ linkedProductIds, ...rest }) {
      const created = makeActivity({
        ...rest,
        linkedProducts: toLinkedProducts(linkedProductIds),
        id: "created-id",
      });
      activities.set(created.id, created);
      return created;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- implements the async repository contract; no awaitable work in the stub
    async update({ linkedProductIds, ...rest }) {
      const next = makeActivity({
        ...activities.get(rest.id),
        ...rest,
        linkedProducts: toLinkedProducts(linkedProductIds),
      });
      activities.set(next.id, next);
      return next;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- implements the async repository contract; no awaitable work in the stub
    async setArchived(id, archived) {
      const next = makeActivity({ ...activities.get(id), id, archived });
      activities.set(id, next);
      return next;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- implements the async repository contract; no awaitable work in the stub
    async attachLead(edge) {
      attached.push(edge);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- implements the async repository contract; no awaitable work in the stub
    async detachLead(edge) {
      detached.push(edge);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- implements the async repository contract; no awaitable work in the stub
    async groupExists(groupId) {
      return (fixture.groups ?? [GROUP_A, GROUP_B]).includes(groupId);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- implements the async repository contract; no awaitable work in the stub
    async productExists(productId) {
      return (fixture.products ?? [PRODUCT_ID]).includes(productId);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- implements the async repository contract; no awaitable work in the stub
    async getLeadContext(leadId) {
      const users = fixture.users ?? {
        [LEAD_IN_A]: { role: "lead", reportingGroupId: GROUP_A },
        [LEAD_IN_B]: { role: "lead", reportingGroupId: GROUP_B },
        [HEAD_IN_A]: { role: "head", reportingGroupId: GROUP_A },
      };
      return users[leadId] ?? null;
    },
  };

  return { repository, attached, detached };
}

describe("ProjectActivityService — create/update/archive", () => {
  it("creates an activity with the authoritative group and linked products", async () => {
    const { repository } = createRepository();
    const service = new ProjectActivityService(repository);

    const created = await service.create({
      name: "Ops rotation",
      groupId: GROUP_A,
      linkedProductIds: [PRODUCT_ID],
      jiraAccounts: ["OPS"],
    });

    expect(created.groupId).toBe(GROUP_A);
    expect(created.linkedProducts.map((link) => link.productId)).toEqual([
      PRODUCT_ID,
    ]);
    expect(created.jiraAccounts).toEqual(["OPS"]);
  });

  it("rejects a create referencing a missing group", async () => {
    const { repository } = createRepository({ groups: [] });
    const service = new ProjectActivityService(repository);

    await expect(
      service.create({
        name: "X",
        groupId: GROUP_A,
        linkedProductIds: [],
        jiraAccounts: [],
      }),
    ).rejects.toBeInstanceOf(ProjectActivityNotFoundError);
  });

  it("rejects a create referencing a missing product", async () => {
    const { repository } = createRepository({ products: [] });
    const service = new ProjectActivityService(repository);

    await expect(
      service.create({
        name: "X",
        groupId: GROUP_A,
        linkedProductIds: [PRODUCT_ID],
        jiraAccounts: [],
      }),
    ).rejects.toBeInstanceOf(ProjectActivityNotFoundError);
  });

  it("rejects an update of a missing activity", async () => {
    const { repository } = createRepository();
    const service = new ProjectActivityService(repository);

    await expect(
      service.update({
        id: "99999999-9999-4999-8999-999999999999",
        name: "X",
        groupId: GROUP_A,
        linkedProductIds: [],
        jiraAccounts: [],
      }),
    ).rejects.toBeInstanceOf(ProjectActivityNotFoundError);
  });

  it("archives and unarchives via the archived flag", async () => {
    const activity = makeActivity();
    const { repository } = createRepository({ activities: [activity] });
    const service = new ProjectActivityService(repository);

    const archived = await service.archive({ id: activity.id, archived: true });
    expect(archived.archived).toBe(true);
  });

  it("rejects a group move while lead attachments exist", async () => {
    // Attach validates lead.reportingGroupId === activity.groupId at write; a
    // group move with live attachments would strand them past that constraint.
    const activity = makeActivity({ leadIds: [LEAD_IN_A] });
    const { repository } = createRepository({ activities: [activity] });
    const service = new ProjectActivityService(repository);

    await expect(
      service.update({
        id: activity.id,
        name: activity.name,
        groupId: GROUP_B,
        linkedProductIds: [],
        jiraAccounts: [],
      }),
    ).rejects.toBeInstanceOf(ProjectActivityDomainError);
  });

  it("allows a group move once no leads are attached", async () => {
    const activity = makeActivity({ leadIds: [] });
    const { repository } = createRepository({ activities: [activity] });
    const service = new ProjectActivityService(repository);

    const moved = await service.update({
      id: activity.id,
      name: activity.name,
      groupId: GROUP_B,
      linkedProductIds: [],
      jiraAccounts: [],
    });

    expect(moved.groupId).toBe(GROUP_B);
  });

  it("same-group update proceeds even with attached leads", async () => {
    const activity = makeActivity({ leadIds: [LEAD_IN_A] });
    const { repository } = createRepository({ activities: [activity] });
    const service = new ProjectActivityService(repository);

    const renamed = await service.update({
      id: activity.id,
      name: "Ops rotation (renamed)",
      groupId: GROUP_A,
      linkedProductIds: [],
      jiraAccounts: ["OPS"],
    });

    expect(renamed.name).toBe("Ops rotation (renamed)");
    expect(renamed.groupId).toBe(GROUP_A);
  });
});

describe("ProjectActivityService — lead attachment (M:M, group-constrained)", () => {
  it("attaches a lead from the activity's own group", async () => {
    const activity = makeActivity();
    const { repository, attached } = createRepository({
      activities: [activity],
    });
    const service = new ProjectActivityService(repository);

    await service.attachLead({ activityId: activity.id, leadId: LEAD_IN_A });

    expect(attached).toEqual([{ activityId: activity.id, leadId: LEAD_IN_A }]);
  });

  it("rejects a lead from another reporting group (group constrained at write)", async () => {
    const activity = makeActivity();
    const { repository, attached } = createRepository({
      activities: [activity],
    });
    const service = new ProjectActivityService(repository);

    await expect(
      service.attachLead({ activityId: activity.id, leadId: LEAD_IN_B }),
    ).rejects.toBeInstanceOf(ProjectActivityDomainError);
    expect(attached).toEqual([]);
  });

  it("rejects a non-lead role", async () => {
    const activity = makeActivity();
    const { repository } = createRepository({ activities: [activity] });
    const service = new ProjectActivityService(repository);

    await expect(
      service.attachLead({ activityId: activity.id, leadId: HEAD_IN_A }),
    ).rejects.toBeInstanceOf(ProjectActivityDomainError);
  });

  it("rejects attaching to an archived activity", async () => {
    const activity = makeActivity({ archived: true });
    const { repository } = createRepository({ activities: [activity] });
    const service = new ProjectActivityService(repository);

    await expect(
      service.attachLead({ activityId: activity.id, leadId: LEAD_IN_A }),
    ).rejects.toBeInstanceOf(ProjectActivityDomainError);
  });

  it("detaches an attached lead", async () => {
    const activity = makeActivity();
    const { repository, detached } = createRepository({
      activities: [activity],
    });
    const service = new ProjectActivityService(repository);

    await service.detachLead({ activityId: activity.id, leadId: LEAD_IN_A });

    expect(detached).toEqual([{ activityId: activity.id, leadId: LEAD_IN_A }]);
  });
});
