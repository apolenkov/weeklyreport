import { randomInt, randomUUID } from "node:crypto";

import type { Api } from "./scenario-api.ts";

type Row = Readonly<{ id: string }>;

const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;
const FIRST_MONDAY = 6;
const ID_PREFIX = 8;
const SPREAD_WEEKS = 300;
/** A week far outside the demo seed (a random one, so repeated runs never overlap), as a synthetic period. */
const FAR_YEAR = 2031;
const FAR_MONDAY =
  Date.UTC(FAR_YEAR, 0, FIRST_MONDAY) +
  randomInt(SPREAD_WEEKS) * WEEK_DAYS * DAY_MS;

/**
 * Admin handlers the crawler skips as dangerous. Every record written here is created by the scenario
 * (a fresh uuid) and removed again, or is rewritten with the values it already has, so the later steps
 * keep working on the demo seed; the stand is reset after the run anyway.
 */
export function adminScenario(api: Api): void {
  records(api);
  periods(api);
  settings(api);
  activities(api);
  aiProvider(api);
  aiPrompts(api);
}

const DEMO_GROUP = "a0000000-0000-4000-8000-000000000301";
const DEMO_LEAD = "a0000000-0000-4000-8000-000000000011";
const PROMPT_FEATURE = "lead-report-assistant";
const PROMPT_BASE = "a0000000-0000-4000-8000-00000000a001";

function activities(api: Api): void {
  const admin = api.as("admin");
  const created = admin.mutate("create an activity", "projectActivity.create", {
    name: "Scenario activity",
    groupId: DEMO_GROUP,
  }).data as Readonly<{ id?: string }> | undefined;
  const id = created?.id;
  if (!id) return;
  admin.mutate("rename the activity", "projectActivity.update", {
    id,
    name: "Scenario activity renamed",
    groupId: DEMO_GROUP,
  });
  admin.mutate("attach a lead", "projectActivity.attachLead", {
    activityId: id,
    leadId: DEMO_LEAD,
  });
  admin.mutate("detach the lead", "projectActivity.detachLead", {
    activityId: id,
    leadId: DEMO_LEAD,
  });
  admin.mutate("archive the activity", "projectActivity.archive", {
    id,
    archived: true,
  });
}

/**
 * The provider revision lifecycle up to the point that needs the outside world: a draft is saved, read
 * and discarded. Testing it would call the provider's host with the credential, so it is never run;
 * activation and restore are asked for and refused, which exercises their guards.
 */
function aiProvider(api: Api): void {
  const admin = api.as("admin");
  const saved = admin.mutate("save a provider draft", "admin.aiProvider.save", {
    generation: {
      profile: "openai",
      plannerModel: "scenario-model",
      answerModel: "scenario-model",
      reasoningMode: "off",
      credential: "scenario-credential",
    },
    embeddings: { mode: "reuse_generation", model: "scenario-embeddings" },
  }).data as Readonly<{ id?: string }> | undefined;
  const revisionId = saved?.id;
  if (!revisionId) return;
  admin.query("read the preparation progress", "admin.aiProvider.progress", {
    revisionId,
  });
  admin.mutate(
    "activate an untested draft",
    "admin.aiProvider.activate",
    { revisionId },
    "refused",
  );
  admin.mutate(
    "restore an untested draft",
    "admin.aiProvider.restore",
    { revisionId },
    "refused",
  );
  admin.mutate("discard the draft", "admin.aiProvider.discard", { revisionId });
  admin.mutate("disable the provider", "admin.aiProvider.disable");
}

/** A prompt draft is activated, the seeded revision restored, and a second draft discarded. */
function aiPrompts(api: Api): void {
  const admin = api.as("admin");
  const contents = {
    planner: "Scenario planner prompt.",
    "planner-repair": "Scenario repair prompt.",
    "grounded-answer": "Scenario answer prompt.",
    "citation-repair": "Scenario citation prompt.",
  };
  const draft = (step: string): string | undefined =>
    (
      admin.mutate(step, "admin.aiPrompts.draft", {
        featureKey: PROMPT_FEATURE,
        baseRevisionId: PROMPT_BASE,
        promptContents: contents,
      }).data as Readonly<{ id?: string }> | undefined
    )?.id;
  const first = draft("draft a prompt");
  if (first)
    admin.mutate("activate the draft", "admin.aiPrompts.activate", {
      featureKey: PROMPT_FEATURE,
      revisionId: first,
    });
  admin.mutate("restore the seeded revision", "admin.aiPrompts.restore", {
    featureKey: PROMPT_FEATURE,
    revisionId: PROMPT_BASE,
  });
  const second = draft("draft another prompt");
  if (second)
    admin.mutate("discard the draft", "admin.aiPrompts.discard", {
      featureKey: PROMPT_FEATURE,
      revisionId: second,
    });
}

/** One group with a lead and a product of its own: created, linked, unlinked and removed. */
function records(api: Api): void {
  const admin = api.as("admin");
  const group = randomUUID();
  const user = randomUUID();
  const product = randomUUID();
  admin.mutate("create a group", "admin.saveReportingGroup", {
    id: group,
    name: `Scenario group ${group.slice(0, ID_PREFIX)}`,
    description: null,
    archived: false,
    headUserId: null,
  });
  admin.mutate("create a user", "admin.saveUser", {
    id: user,
    email: `scenario.${user.slice(0, ID_PREFIX)}@weeklyreport.local`,
    name: "Scenario User",
    lastName: "User",
    firstName: "Scenario",
    middleName: null,
    position: null,
    role: "lead",
    reportingGroupId: group,
    reportingGroupName: null,
    isActive: true,
  });
  admin.mutate("create a product", "admin.saveProject", {
    id: product,
    name: `Scenario product ${product.slice(0, ID_PREFIX)}`,
    archived: false,
    leadId: user,
    leadName: "Scenario User",
  });
  admin.query("list the group's products", "admin.listGroupProducts", {
    groupId: group,
  });
  admin.mutate("detach the product", "admin.detachProductFromGroup", {
    groupId: group,
    productId: product,
  });
  admin.mutate("attach the product", "admin.attachProductToGroup", {
    groupId: group,
    productId: product,
  });
  stages(api, user, product);
  admin.mutate("delete the product", "admin.deleteProject", {
    projectId: product,
  });
  admin.mutate("deactivate the user", "admin.deactivateUser", { userId: user });
  admin.mutate("activate the user", "admin.activateUser", { userId: user });
  // a lead that has report sections cannot be deleted: a plain viewer shows the deletion
  const viewer = randomUUID();
  admin.mutate("create a viewer", "admin.saveUser", {
    id: viewer,
    email: `scenario.${viewer.slice(0, ID_PREFIX)}@weeklyreport.local`,
    name: "Scenario Viewer",
    lastName: "Viewer",
    firstName: "Scenario",
    middleName: null,
    position: null,
    role: "viewer",
    reportingGroupId: null,
    reportingGroupName: null,
    isActive: true,
  });
  admin.mutate("delete the viewer", "admin.deleteUser", { userId: viewer });
  admin.mutate("archive the group", "admin.archiveReportingGroup", {
    groupId: group,
  });
}

function stages(api: Api, userId: string, projectId: string): void {
  const admin = api.as("admin");
  const stage = (
    admin.query("list stages", "admin.listStages").data as readonly Row[]
  )[0];
  if (!stage) return;
  admin.mutate("assign a stage", "admin.saveStageAssignment", {
    userId,
    stageId: stage.id,
    projectId,
  });
  const assignment = (
    admin.query("list the assignments", "admin.listStageAssignments", {
      projectId,
    }).data as readonly Row[] | undefined
  )?.[0];
  if (assignment)
    admin.mutate("remove the assignment", "admin.deleteStageAssignment", {
      id: assignment.id,
    });
}

function periods(api: Api): void {
  const admin = api.as("admin");
  const created = admin.mutate("create a period", "admin.createPeriodManual", {
    periodStart: new Date(FAR_MONDAY),
    periodEnd: new Date(FAR_MONDAY + (WEEK_DAYS - 1) * DAY_MS),
    weekLabel: "Scenario week",
  }).data as Readonly<{ periodId?: string }> | undefined;
  const reportId = created?.periodId;
  if (!reportId) return;
  admin.mutate("rename the period", "admin.updatePeriodManual", {
    reportId,
    weekLabel: "Scenario week renamed",
  });
  admin.mutate("archive the period", "admin.archivePeriod", {
    periodId: reportId,
  });
  admin.mutate("unarchive the period", "admin.unarchivePeriod", {
    periodId: reportId,
  });
  admin.mutate("delete the period", "admin.deleteReport", { reportId });
}

function settings(api: Api): void {
  const admin = api.as("admin");
  const current = admin.query("read settings", "admin.getSettings").data as
    Readonly<Record<string, unknown>> | undefined;
  if (current)
    admin.mutate("save the same settings", "admin.updateSettings", current);
  const org = admin.query("read the organization", "admin.getOrganization")
    .data as Readonly<{ shortName: string; fullName: string }> | undefined;
  if (org)
    admin.mutate("save the same organization", "admin.updateOrganization", {
      shortName: org.shortName,
      fullName: org.fullName,
    });
  const policyId = randomUUID();
  admin.mutate("create a reminder policy", "admin.savePolicy", {
    id: policyId,
    kind: "deadline",
    offsetMinutes: -60,
    timezone: "Europe/Moscow",
    audience: "lead-with-draft",
    active: false,
    validFrom: new Date(FAR_MONDAY),
  });
  admin.query("list the policies", "admin.listPolicies");
  admin.mutate("remove the policy", "admin.removePolicy", { id: policyId });
}
