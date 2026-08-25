import { randomUUID } from "node:crypto";

import type { ElementHandle } from "@playwright/test";

import type {
  RenderedNameActionLease,
  RenderedTargetValidator,
} from "../control-actions/control-action-types.ts";

export const RENDERED_TARGET_VALIDATOR_PROPERTY =
  "__runtimeSweepActionValidator";
export const RENDERED_TARGET_GUARD_PROPERTY = "__runtimeSweepActionGuard";
const POST_DEADLINE_EVENT_QUARANTINE_MS = 100;
const DOCUMENT_MUTATION_OPTIONS = {
  attributes: true,
  characterData: true,
  childList: true,
  subtree: true,
} as const;
const GUARDED_EVENT_TYPES = [
  "auxclick",
  "beforeinput",
  "click",
  "contextmenu",
  "dblclick",
  "input",
  "keydown",
  "keypress",
  "keyup",
  "mousedown",
  "mouseup",
  "pointercancel",
  "pointerdown",
  "pointerup",
] as const;
interface RenderedTargetGuard {
  readonly eventGate: EventListener;
  readonly generation: string;
  readonly observer: MutationObserver;
  readonly phase: "acting" | "armed" | "invalidated";
  readonly validator: RenderedTargetValidator;
}
type GuardedElement = HTMLElement &
  Record<string, RenderedTargetGuard | RenderedTargetValidator | undefined>;

interface GuardExpectation {
  readonly deadline: number;
  readonly discoveryGeneration: string;
  readonly eventTypes: readonly string[];
  readonly generation: string;
  readonly guardProperty: string;
  readonly observerOptions: MutationObserverInit;
  readonly quarantineMs: number;
  readonly validatorProperty: string;
}

const evaluateRenderedGuardAvailable = (
  element: Node,
  expected: GuardExpectation,
): boolean => {
  if (!(element instanceof HTMLElement)) return false;
  const guarded = element as GuardedElement;
  const guard = guarded[expected.guardProperty];
  if (typeof guard !== "object") return true;
  const validator = guarded[expected.validatorProperty];
  if (typeof validator === "function" && validator !== guard.validator)
    delete guarded[expected.validatorProperty];
  return false;
};

const evaluateAndArmRenderedName = (
  element: Node,
  expected: GuardExpectation,
): boolean => {
  if (!(element instanceof HTMLElement)) return false;
  const guarded = element as GuardedElement;
  const storedGuard = (): RenderedTargetGuard | undefined =>
    guarded[expected.guardProperty] as RenderedTargetGuard | undefined;
  const storeGuard = (guard: RenderedTargetGuard): void => {
    Object.defineProperty(guarded, expected.guardProperty, {
      configurable: true,
      value: guard,
    });
  };
  const invalidate = (): void => {
    const guard = storedGuard();
    if (guard?.generation !== expected.generation) return;
    if (guard.phase === "invalidated") return;
    storeGuard({ ...guard, phase: "invalidated" });
    if (guarded[expected.validatorProperty] === guard.validator)
      delete guarded[expected.validatorProperty];
  };
  const eventGate: EventListener = (event) => {
    const guard = storedGuard();
    if (guard?.generation !== expected.generation || !event.isTrusted) return;
    if (guard.phase === "invalidated") {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (guard.phase !== "armed") return;
    if (event.type !== "pointerdown" && event.type !== "keydown") {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const target = event.target;
    if (
      guard.observer.takeRecords().length > 0 ||
      !(target instanceof Node) ||
      !element.contains(target) ||
      (event.type === "keydown" && document.activeElement !== element)
    ) {
      invalidate();
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    guard.observer.disconnect();
    storeGuard({ ...guard, phase: "acting" });
  };
  if (storedGuard() !== undefined) return false;
  const validator = guarded[expected.validatorProperty];
  if (
    typeof validator !== "function" ||
    validator.generation !== expected.discoveryGeneration
  )
    return false;
  const generation = expected.generation;
  const observer = new MutationObserver(invalidate);
  storeGuard({ eventGate, generation, observer, phase: "armed", validator });
  for (const eventType of expected.eventTypes)
    window.addEventListener(eventType, eventGate, true);
  observer.observe(document, expected.observerOptions);
  return true;
};

const evaluateRenderedNameGuard = (
  element: Node,
  expected: GuardExpectation,
): boolean => {
  if (!(element instanceof HTMLElement)) return false;
  const guarded = element as GuardedElement;
  const ownedGuard = (): RenderedTargetGuard | undefined => {
    const guard = guarded[expected.guardProperty];
    return typeof guard === "object" && guard.generation === expected.generation
      ? guard
      : undefined;
  };
  const dispose = (): void => {
    const guard = ownedGuard();
    if (guard === undefined) return;
    guard.observer.disconnect();
    for (const eventType of expected.eventTypes)
      window.removeEventListener(eventType, guard.eventGate, true);
    delete guarded[expected.guardProperty];
    if (guarded[expected.validatorProperty] === guard.validator)
      delete guarded[expected.validatorProperty];
  };
  const guard = ownedGuard();
  const validator = guarded[expected.validatorProperty];
  try {
    if (
      guard?.phase !== "armed" ||
      validator !== guard.validator ||
      !validator() ||
      element.matches(":disabled") ||
      element.getAttribute("aria-disabled") === "true" ||
      Date.now() > expected.deadline ||
      guard.observer.takeRecords().length > 0
    ) {
      dispose();
      return false;
    }
  } catch (error: unknown) {
    dispose();
    throw error;
  }
  window.setTimeout(
    () => {
      const current = ownedGuard();
      if (current === undefined) return;
      Object.defineProperty(guarded, expected.guardProperty, {
        configurable: true,
        value: { ...current, phase: "invalidated" },
      });
      if (guarded[expected.validatorProperty] === current.validator)
        delete guarded[expected.validatorProperty];
      if (current.phase !== "acting") {
        dispose();
        return;
      }
      window.setTimeout(dispose, expected.quarantineMs);
    },
    Math.max(0, expected.deadline - Date.now()),
  );
  return true;
};

export const armRenderedNameHandle = (
  handle: ElementHandle<HTMLElement>,
  activationDeadline: number,
  discoveryGeneration: string,
): Promise<RenderedNameActionLease | undefined> => {
  const lease = {
    deadline: activationDeadline,
    generation: randomUUID(),
  };
  const expected = {
    ...lease,
    discoveryGeneration,
    eventTypes: GUARDED_EVENT_TYPES,
    guardProperty: RENDERED_TARGET_GUARD_PROPERTY,
    observerOptions: DOCUMENT_MUTATION_OPTIONS,
    quarantineMs: POST_DEADLINE_EVENT_QUARANTINE_MS,
    validatorProperty: RENDERED_TARGET_VALIDATOR_PROPERTY,
  };
  return handle
    .evaluate(evaluateRenderedGuardAvailable, expected)
    .then((available) =>
      available ? handle.evaluate(evaluateAndArmRenderedName, expected) : false,
    )
    .then((installed) =>
      installed ? handle.evaluate(evaluateRenderedNameGuard, expected) : false,
    )
    .then((armed) => (armed ? lease : undefined));
};

export const beginRenderedNameAction = (
  handle: ElementHandle<HTMLElement>,
  lease: RenderedNameActionLease,
): Promise<boolean> =>
  handle.evaluate(
    (element, expected) => {
      const guarded = element as GuardedElement;
      const guard = guarded[expected.guardProperty];
      return (
        typeof guard === "object" &&
        guard.generation === expected.generation &&
        guard.phase === "armed" &&
        Date.now() <= expected.deadline
      );
    },
    {
      ...lease,
      guardProperty: RENDERED_TARGET_GUARD_PROPERTY,
    },
  );

export const completeRenderedNameAction = (
  handle: ElementHandle<HTMLElement>,
  lease: RenderedNameActionLease,
): Promise<boolean> =>
  handle.evaluate(
    (element, expected) => {
      const guarded = element as GuardedElement;
      const guard = guarded[expected.guardProperty];
      return (
        typeof guard === "object" &&
        guard.generation === expected.generation &&
        guard.phase === "acting"
      );
    },
    {
      generation: lease.generation,
      guardProperty: RENDERED_TARGET_GUARD_PROPERTY,
    },
  );

export const cleanupRenderedNameGuard = (
  handle: ElementHandle<HTMLElement>,
  lease: RenderedNameActionLease,
): Promise<void> =>
  handle.evaluate(
    (element, cleanup) => {
      const guarded = element as GuardedElement;
      const guard = guarded[cleanup.guardProperty];
      const owned =
        typeof guard === "object" && guard.generation === cleanup.generation;
      if (owned) {
        guard.observer.disconnect();
        for (const eventType of cleanup.eventTypes)
          window.removeEventListener(eventType, guard.eventGate, true);
        delete guarded[cleanup.guardProperty];
      }
      if (
        typeof guard === "object" &&
        owned &&
        guarded[cleanup.validatorProperty] === guard.validator
      )
        delete guarded[cleanup.validatorProperty];
    },
    {
      eventTypes: GUARDED_EVENT_TYPES,
      generation: lease.generation,
      guardProperty: RENDERED_TARGET_GUARD_PROPERTY,
      validatorProperty: RENDERED_TARGET_VALIDATOR_PROPERTY,
    },
  );
