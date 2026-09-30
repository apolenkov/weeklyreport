import assert from "node:assert/strict";

import {
  ARCHIVED_FILL_FIXTURE,
  LEAD_FORM_FIXTURE,
  OPEN_WORK_FIXTURE,
} from "../setup/fixture-data.js";
import {
  command,
  findRole,
  getAttr,
  headSession,
  open,
  refsByRole,
  snapshot,
  waitText,
} from "./browser.js";

export { ARCHIVED_FILL_FIXTURE, LEAD_FORM_FIXTURE, OPEN_WORK_FIXTURE };
export { scopeCount, scopeSnapshot } from "./snapshot-scope.js";

export async function roleText(
  role: string,
  name: string,
  session?: string,
): Promise<string> {
  const data = await findRole(role, name, "text", undefined, session);
  assert(typeof data.text === "string", "Invalid browser role text result");
  return data.text;
}

export async function setOffline(
  offline: boolean,
  session?: string,
): Promise<void> {
  await command(["set", "offline", offline ? "on" : "off"], session);
  await command(["wait", "--fn", `navigator.onLine === ${!offline}`], session);
}

const authenticatedLeadSessions = new Set<string | undefined>();
const SAVE_BUTTONS = `Array.from(document.getElementsByTagName('div'))
  .filter(group => group.getAttribute('role') === 'group' && ['Header completion actions', 'Sticky completion actions'].includes(group.getAttribute('aria-label')))
  .flatMap(group => Array.from(group.getElementsByTagName('button')))
  .filter(button => ['Save draft now', 'Retry saving draft', 'Saving draft', 'Draft saved'].includes(button.getAttribute('aria-label')))
  .filter(button => button.getClientRects().length > 0)`;

export async function loginAsLead(session?: string): Promise<void> {
  await open("/?stay=1", session);
  await findRole("link", "Lead", "click", undefined, session);
  await command(["wait", "--url", "**/lead/report**"], session);
  await waitText("My Report", session);
  authenticatedLeadSessions.add(session ?? process.env.AGENT_BROWSER_SESSION);
}

export async function loginAsHead(session = headSession()): Promise<void> {
  await open("/?stay=1", session);
  await findRole("link", "Head", "click", undefined, session);
  await command(["wait", "--url", "**/head/dashboard**"], session);
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
  await waitText("My Report", session);
  const label =
    mode === "overview"
      ? "Status overview"
      : "Status slide deck (use arrow keys to navigate slides)";
  await command(
    [
      "wait",
      "--fn",
      String.raw`Array.from(document.getElementsByTagName('section')).some(section => section.getClientRects().length > 0 && (section.getAttribute('aria-label') ?? (section.getAttribute('aria-labelledby') ?? '').split(/\s+/).map(id => document.getElementById(id)?.textContent?.trim() ?? '').join(' ')) === ${JSON.stringify(label)})`,
    ],
    session,
  );
  await findRole(
    mode === "overview" ? "region" : "group",
    label,
    "text",
    undefined,
    session,
  );
}

export async function saveDraft(session?: string): Promise<void> {
  await command(
    [
      "wait",
      "--fn",
      `(() => { const buttons = ${SAVE_BUTTONS}; return buttons.length === 1 && buttons[0].getAttribute('aria-busy') === 'false'; })()`,
    ],
    session,
  );
  const data = await snapshot(session);
  const saveRefs = [
    "Save draft now",
    "Retry saving draft",
    "Draft saved",
  ].flatMap((name) => refsByRole(data, "button", name));
  assert(saveRefs.length === 1, "Expected one draft-save button");
  const ref = saveRefs.at(0);
  assert(ref, "Missing draft-save button");
  if ((await getAttr(ref, "disabled", session)) === null) {
    await command(["click", ref], session);
  }
  await command(
    [
      "wait",
      "--fn",
      `(() => { const buttons = ${SAVE_BUTTONS}; return buttons.length === 1 && buttons[0].disabled && buttons[0].getAttribute('aria-busy') === 'false' && ['Save draft now', 'Draft saved'].includes(buttons[0].getAttribute('aria-label')); })()`,
    ],
    session,
  );
}
