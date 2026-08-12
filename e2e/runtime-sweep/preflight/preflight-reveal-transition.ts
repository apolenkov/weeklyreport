import type { RevealRepresentativeInput } from "../matrix/reveal-transition.ts";
import type { DomControlObservation } from "../replay/dom-inventory.ts";
import type { LiveControlPlan } from "../replay/live-control-planning.ts";
import { representativeFillValueForInputType } from "../replay/representative-form-input.ts";
import type { Action } from "../source/contracts.ts";
import type { RevealRoute } from "./preflight-reveal-types.ts";

const URL_BASE = "https://runtime-sweep.invalid";
const MUTATION_REQUIRED = "mutation-required" as const;

export type { RevealRepresentativeInput } from "../matrix/reveal-transition.ts";

export type RevealTransitionClassification = Readonly<
  | { readonly kind: "read-only-click"; readonly action: Action }
  | { readonly kind: "client-form"; readonly action: Action }
  | {
      readonly kind: "cross-route-catalog-link";
      readonly action: Action;
      readonly reason: string;
    }
  | {
      readonly kind: typeof MUTATION_REQUIRED;
      readonly action: Action;
      readonly reason: string;
    }
  | {
      readonly kind: "ordinary-control";
      readonly action: Action;
      readonly reason: string;
    }
  | {
      readonly kind: "not-exercised";
      readonly reason: string;
    }
>;

const resolvedRouteFor = (route: RevealRoute): URL =>
  new URL(route.resolvedRoute, URL_BASE);

const resolvedControlHrefFor = (
  control: Pick<DomControlObservation, "href">,
  route: RevealRoute,
): URL | undefined =>
  control.href === null
    ? undefined
    : new URL(control.href, resolvedRouteFor(route));

const isCrossRouteCatalogLink = (
  control: DomControlObservation,
  action: Action,
  route: RevealRoute,
): boolean => {
  const target = resolvedControlHrefFor(control, route);
  return (
    control.role === "link" &&
    action.operation === "click" &&
    target !== undefined &&
    target.pathname !== resolvedRouteFor(route).pathname
  );
};

const isSameDocumentFragmentLink = (
  control: DomControlObservation,
  action: Action,
  route: RevealRoute,
): boolean => {
  if (
    control.role !== "link" ||
    action.operation !== "click" ||
    action.safety !== "read-only" ||
    control.href === null ||
    control.href === ""
  )
    return false;
  const target = resolvedControlHrefFor(control, route);
  if (target === undefined) return false;
  const resolvedRoute = resolvedRouteFor(route);
  return (
    target.hash !== "" &&
    target.pathname === resolvedRoute.pathname &&
    target.search === resolvedRoute.search
  );
};

export const classifyRevealTransition = (
  plan: LiveControlPlan,
  route: RevealRoute,
): RevealTransitionClassification => {
  if (plan.action === undefined)
    return {
      kind: "not-exercised",
      reason: plan.reason ?? "No bounded control action was declared",
    };
  const { action } = plan;
  if (isSameDocumentFragmentLink(plan.control, action, route))
    return {
      kind: "ordinary-control",
      action,
      reason:
        "Same-document fragment links remain ordinary frozen action cells, not reveal preparation",
    };
  if (isCrossRouteCatalogLink(plan.control, action, route))
    return {
      kind: "cross-route-catalog-link",
      action,
      reason:
        "Cross-route catalog links remain ordinary frozen action cells, not reveal preparation",
    };
  if (plan.control.interactionEffect === MUTATION_REQUIRED)
    return {
      kind: MUTATION_REQUIRED,
      action,
      reason:
        "Controls with immediate product effects require separately prepared deterministic state",
    };
  if (
    (action.operation === "fill" || action.operation === "select") &&
    action.safety === "irreversible" &&
    action.transition === "none"
  )
    return { kind: "client-form", action };
  if (action.operation === "click" && action.safety === "read-only")
    return { kind: "read-only-click", action };
  if (action.safety !== "read-only" || action.transition !== "none")
    return {
      kind: MUTATION_REQUIRED,
      action,
      reason:
        "Mutation-requiring transitions use a separately prepared deterministic state, never reveal preparation",
    };
  return {
    kind: "ordinary-control",
    action,
    reason: "Action is bounded but is not a reveal transition",
  };
};

export const representativeInputForFill = (
  control: Pick<DomControlObservation, "inputType">,
): RevealRepresentativeInput => {
  return {
    kind: "fill",
    value: representativeFillValueForInputType(control.inputType),
  };
};

export const representativeInputFor = (
  plan: Pick<LiveControlPlan, "control" | "action">,
): RevealRepresentativeInput | undefined => {
  if (plan.action?.operation === "fill")
    return representativeInputForFill(plan.control);
  return undefined;
};
