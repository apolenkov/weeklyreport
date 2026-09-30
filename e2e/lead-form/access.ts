import assert from "node:assert/strict";

import {
  DEV_LOGIN_EMAIL_BY_ROLE,
  ROLE_HOME_PATH,
  ROLE_LABEL,
} from "@customreport/shared";

import { LEAD_FORM_FIXTURE } from "../setup/fixture-data.js";
import {
  findRole,
  getAttr,
  getUrl,
  headSession,
  open,
  refsByRole,
} from "./browser.js";
import { waitScope, waitSnapshot } from "./helpers.js";

const authenticatedLeadSessions = new Set<string | undefined>();

async function login(role: "lead" | "head", session?: string): Promise<void> {
  await open("/?stay=1", session);
  const name = ROLE_LABEL[role];
  const data = await waitScope({ role: "link", name }, session);
  const links = refsByRole(data, "link", name);
  assert.equal(links.length, 1, `Expected one ${name} dev-login link`);
  const ref = links.at(0);
  assert(ref);
  const href = await getAttr(ref, "href", session);
  assert(href, "Missing dev-login link target");
  const url = new URL(href, "http://localhost:3000");
  assert.equal(url.pathname, "/auth/dev-login");
  assert.equal(url.searchParams.get("role"), role);
  assert.equal(url.searchParams.get("email"), DEV_LOGIN_EMAIL_BY_ROLE[role]);
  await findRole("link", name, "click", { session });
  const homePath = ROLE_HOME_PATH[role];
  await waitSnapshot(
    async () => {
      const pathname = new URL(await getUrl(session)).pathname;
      return pathname === homePath || pathname.startsWith(`${homePath}/`);
    },
    `Expected ${name} home at ${homePath}`,
    session,
  );
}

export async function loginAsLead(session?: string): Promise<void> {
  await login("lead", session);
  await waitScope({ role: "heading", name: "My Report" }, session);
  authenticatedLeadSessions.add(session ?? process.env.AGENT_BROWSER_SESSION);
}

export async function loginAsHead(session = headSession()): Promise<void> {
  await login("head", session);
}

export async function openLeadReport(
  mode: "overview" | "slides" = "overview",
  session?: string,
): Promise<void> {
  if (
    !authenticatedLeadSessions.has(session ?? process.env.AGENT_BROWSER_SESSION)
  ) {
    await loginAsLead(session);
  }
  await open(
    `/lead/report/${LEAD_FORM_FIXTURE.reportId}?mode=${mode}`,
    session,
  );
  await waitScope({ role: "heading", name: "My Report" }, session);
  const scope = {
    role: mode === "overview" ? "region" : "group",
    name:
      mode === "overview"
        ? "Status overview"
        : "Status slide deck (use arrow keys to navigate slides)",
  };
  await waitScope(scope, session);
  await findRole(scope.role, scope.name, "text", { session });
}
