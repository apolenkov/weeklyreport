import assert from "node:assert/strict";

import {
  ARCHIVED_FILL_FIXTURE,
  LEAD_FORM_FIXTURE,
  OPEN_WORK_FIXTURE,
} from "../setup/fixture-data.js";
import { command, findRole, getAttr, refsByRole, snapshot } from "./browser.js";
import type { BrowserSnapshot } from "./snapshot-scope.js";
import { scopeCount, scopeSnapshot } from "./snapshot-scope.js";

export { ARCHIVED_FILL_FIXTURE, LEAD_FORM_FIXTURE, OPEN_WORK_FIXTURE };
export { scopeCount, scopeSnapshot, scopeSnapshots } from "./snapshot-scope.js";

export interface Scope {
  readonly role: string;
  readonly name: string | RegExp;
}

const VISIBILITY_TIMEOUT_MS = 25_000;

export async function waitSnapshot(
  condition: (data: BrowserSnapshot) => boolean | Promise<boolean>,
  description: string,
  session?: string,
): Promise<BrowserSnapshot> {
  const deadline = performance.now() + VISIBILITY_TIMEOUT_MS;
  let observed = await snapshot(session);
  while (!(await condition(observed))) {
    assert(
      performance.now() < deadline,
      `${description}\n${observed.snapshot}`,
    );
    observed = await snapshot(session);
  }
  return observed;
}

export function oneRef(
  data: BrowserSnapshot,
  role: string,
  name: string | RegExp,
): string {
  const refs = refsByRole(data, role, name);
  assert.equal(refs.length, 1, `Expected one ${role}: ${String(name)}`);
  const ref = refs.at(0);
  assert(ref, "Missing accessibility reference");
  return ref;
}

export async function scopedRef(
  scope: Scope,
  role: string,
  name: string | RegExp,
  session?: string,
): Promise<string> {
  return oneRef(
    scopeSnapshot(await waitScope(scope, session), scope.role, scope.name),
    role,
    name,
  );
}

function scopePredicate(scope: Scope): string {
  const name =
    scope.name instanceof RegExp
      ? `new RegExp(${JSON.stringify(scope.name.source)}, ${JSON.stringify(scope.name.flags)}).test(name)`
      : `name === ${JSON.stringify(scope.name)}`;
  const role = JSON.stringify(scope.role);
  return String.raw`(() => {
    const roleMatches = element.getAttribute('role') === ${role}
      || (${role} === 'form' && element.tagName === 'FORM')
      || (${role} === 'region' && element.tagName === 'SECTION');
    const name = element.getAttribute('aria-label')
      ?? (element.getAttribute('aria-labelledby') ?? '').split(/\s+/)
        .map(id => document.getElementById(id)?.textContent?.replace(/\s+/g, ' ').trim() ?? '').join(' ');
    return roleMatches && (${name});
  })()`;
}

export async function waitScope(
  scope: Scope,
  session?: string,
): Promise<BrowserSnapshot> {
  const observed = await waitSnapshot(
    (data) => scopeCount(data, scope.role, scope.name) === 1,
    `Expected ${scope.role}: ${String(scope.name)}`,
    session,
  );
  if (scope.role === "dialog" || scope.role === "alertdialog") {
    await command(
      [
        "wait",
        "--fn",
        `(() => {
          const dialogs = Array.from(document.getElementsByTagName('div')).filter(element => ${scopePredicate(scope)});
          if (dialogs.length !== 1) return false;
          const dialog = dialogs[0];
          if (dialog.getAnimations().some(animation => animation.playState === 'running')) return false;
          const rect = dialog.getBoundingClientRect();
          const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return rect.width > 0 && rect.height > 0 && target !== null && dialog.contains(target);
        })()`,
      ],
      session,
    );
    return snapshot(session);
  }
  return observed;
}

export async function waitClosed(
  scope: Scope,
  session?: string,
): Promise<void> {
  await waitSnapshot(
    (data) => scopeCount(data, scope.role, scope.name) === 0,
    `Expected closed ${scope.role}: ${String(scope.name)}`,
    session,
  );
  if (scope.role === "dialog" || scope.role === "alertdialog") {
    await command(
      [
        "wait",
        "--fn",
        `Array.from(document.getElementsByTagName('div')).every(element => !${scopePredicate(scope)})`,
      ],
      session,
    );
  }
}

export async function waitButton(
  name: string,
  options: {
    readonly present?: boolean;
    readonly busy?: boolean;
    readonly session?: string;
  } = {},
): Promise<void> {
  await waitSnapshot(
    async (data) => {
      const refs = refsByRole(data, "button", name);
      if (options.present === false) return refs.length === 0;
      if (options.busy === undefined) return refs.length > 0;
      for (const ref of refs) {
        if (
          (await getAttr(ref, "aria-busy", options.session)) ===
          String(options.busy)
        )
          return true;
      }
      return false;
    },
    `Expected button ${name}, present=${options.present ?? true}, busy=${String(options.busy)}`,
    options.session,
  );
}

export async function clickBackdrop(
  name: string,
  session?: string,
): Promise<void> {
  const data = await command(
    [
      "eval",
      `(() => { const dialogs = Array.from(document.getElementsByTagName('div')).filter(element => ${scopePredicate({ role: "dialog", name })}); if (dialogs.length !== 1) throw new Error('Expected one named dialog'); const rect = dialogs[0].getBoundingClientRect(); return { x: rect.x, y: rect.y, height: rect.height }; })()`,
    ],
    session,
  );
  const box = data.result;
  assert(typeof box === "object" && box !== null);
  assert("x" in box && typeof box.x === "number" && box.x > 1);
  assert("y" in box && typeof box.y === "number");
  assert("height" in box && typeof box.height === "number" && box.height > 0);
  await command(
    [
      "mouse",
      "move",
      String(Math.floor(box.x - 1)),
      String(Math.round(box.y + box.height / 2)),
    ],
    session,
  );
  await command(["mouse", "down", "left"], session);
  await command(["mouse", "up", "left"], session);
}

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

const SAVE_BUTTONS = `Array.from(document.getElementsByTagName('div'))
  .filter(group => group.getAttribute('role') === 'group' && ['Header completion actions', 'Sticky completion actions'].includes(group.getAttribute('aria-label')))
  .flatMap(group => Array.from(group.getElementsByTagName('button')))
  .filter(button => ['Save draft now', 'Retry saving draft', 'Saving draft', 'Draft saved'].includes(button.getAttribute('aria-label')))
  .filter(button => button.getClientRects().length > 0)`;

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
