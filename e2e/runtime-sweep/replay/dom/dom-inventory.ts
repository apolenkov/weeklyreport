import type { Page } from "@playwright/test";
import { z } from "zod";

import {
  type KeyboardFocusPolicy,
  type KeyboardFocusScope,
} from "../keyboard/keyboard-focus-policy.ts";
import { INVENTORY_SCRIPT } from "./dom-inventory-script.ts";
export { SOURCE_TEXT_HELPER_SCRIPT } from "./dom-inventory-script.ts";

const LANDMARK_ROLES: ReadonlySet<string> = new Set([
  "alertdialog",
  "dialog",
  "menu",
  "tabpanel",
]);

const ORDER_WIDTH = 4;
const INVENTORY_CONTEXT_ATTEMPTS = 3;

export const RUNTIME_INTERACTION_EFFECTS = [
  "client-only",
  "mutation-required",
] as const;

export const RUNTIME_DISCLOSURE_INDEPENDENCE = [
  "source-bound-row-local",
] as const;

export const runtimePreflightControlInventorySchema = z
  .object({
    ariaRole: z.string().min(1),
    accessibleName: z.string(),
    enabled: z.boolean(),
    order: z.number().int().nonnegative(),
    domOrderKey: z.string().min(1),
    href: z.string().nullable(),
    ariaControls: z.string().min(1).nullable().optional(),
    ariaExpanded: z.boolean().nullable().optional(),
    disclosureIndependence: z.enum(RUNTIME_DISCLOSURE_INDEPENDENCE).optional(),
    keyboardFocusScope: z
      .enum(["page", "active-modal", "background"])
      .optional(),
  })
  .strict();

export type RuntimePreflightControlInventory = z.infer<
  typeof runtimePreflightControlInventorySchema
>;

export type RuntimeDisclosureIndependence =
  (typeof RUNTIME_DISCLOSURE_INDEPENDENCE)[number];

export type RuntimeInteractionEffect =
  (typeof RUNTIME_INTERACTION_EFFECTS)[number];

export interface DomControlObservation {
  readonly controlKey: string;
  readonly domOrderKey: string;
  readonly order: number;
  readonly role: string;
  readonly accessibleName: string;
  readonly enabled: boolean;
  readonly disabled: boolean;
  readonly visible: boolean;
  readonly tagName: string;
  readonly inputType: string | null;
  readonly href: string | null;
  readonly ariaControls?: string | null | undefined;
  readonly ariaExpanded?: boolean | null | undefined;
  readonly disclosureIndependence?: RuntimeDisclosureIndependence | undefined;
  readonly recordStableId?: string | undefined;
  readonly interactionEffect?: RuntimeInteractionEffect;
  readonly keyboardExpectedFocusable?: boolean;
  readonly keyboardFocusPolicy?: KeyboardFocusPolicy;
  readonly keyboardFocusScope?: KeyboardFocusScope;
}

export interface DomInventoryIssue {
  readonly kind: "missing-accessible-name";
  readonly controlKey: string;
  readonly message: string;
}

export interface DomInventory {
  readonly controls: readonly DomControlObservation[];
  readonly issues: readonly DomInventoryIssue[];
  readonly visibleText?: string | undefined;
}

export const domControlDisclosureMetadataFor = (
  control: Pick<
    DomControlObservation,
    | "ariaControls"
    | "ariaExpanded"
    | "disclosureIndependence"
    | "keyboardFocusScope"
  >,
) => ({
  ...(control.ariaControls === undefined
    ? {}
    : { ariaControls: control.ariaControls }),
  ...(control.ariaExpanded === undefined
    ? {}
    : { ariaExpanded: control.ariaExpanded }),
  ...(control.disclosureIndependence === undefined
    ? {}
    : { disclosureIndependence: control.disclosureIndependence }),
  ...(control.keyboardFocusScope === undefined
    ? {}
    : { keyboardFocusScope: control.keyboardFocusScope }),
});

interface RawDomElement {
  readonly role: string;
  readonly tagName: string;
  readonly inputType: string | null;
  readonly href: string | null;
  readonly ariaControls: string | null;
  readonly ariaExpanded: boolean | null;
  readonly disclosureIndependence?: string | null;
  readonly recordStableId: string | null;
  readonly interactionEffect: string | null;
  readonly ariaLabel: string | null;
  readonly labelledByText: string | null;
  readonly labelText: string | null;
  readonly title: string | null;
  readonly imageAlt: string | null;
  readonly value: string | null;
  readonly text: string;
  readonly visible: boolean;
  readonly disabled: boolean;
  readonly keyboardExpectedFocusable?: boolean;
  readonly keyboardFocusPolicy?: KeyboardFocusPolicy;
  readonly keyboardFocusScope?: KeyboardFocusScope;
}

type RawInventoryResult =
  | readonly RawDomElement[]
  | Readonly<{
      readonly elements: readonly RawDomElement[];
      readonly visibleText: string;
    }>;

const isRawInventoryObject = (
  value: RawInventoryResult,
): value is Readonly<{
  readonly elements: readonly RawDomElement[];
  readonly visibleText: string;
}> => !Array.isArray(value);

const normalizeText = (value: string | null): string =>
  (value ?? "").replaceAll(/\s+/g, " ").trim();

const accessibleNameFor = (element: RawDomElement): string => {
  if (element.labelledByText !== null) {
    return normalizeText(element.labelledByText);
  }
  if (element.ariaLabel !== null) {
    return normalizeText(element.ariaLabel);
  }
  if (element.labelText !== null && normalizeText(element.labelText) !== "") {
    return normalizeText(element.labelText);
  }
  for (const value of [element.title, element.imageAlt, element.value]) {
    if (value !== null && normalizeText(value) !== "") {
      return normalizeText(value);
    }
  }
  return LANDMARK_ROLES.has(element.role) ? "" : normalizeText(element.text);
};

const interactionEffectFor = (
  value: string | null,
): RuntimeInteractionEffect | undefined => {
  if (value === null) return undefined;
  const effect = RUNTIME_INTERACTION_EFFECTS.find((entry) => entry === value);
  if (effect !== undefined) return effect;
  throw new Error(`Unsupported data-interaction-effect value: ${value}`);
};

const disclosureIndependenceFor = (
  value: string | null | undefined,
): RuntimeDisclosureIndependence | undefined => {
  if (value === null || value === undefined) return undefined;
  const independence = RUNTIME_DISCLOSURE_INDEPENDENCE.find(
    (entry) => entry === value,
  );
  if (independence !== undefined) return independence;
  throw new Error(`Unsupported data-reveal-independence value: ${value}`);
};

const controlFrom = (
  element: RawDomElement,
  order: number,
  occurrence: number,
): DomControlObservation => {
  const accessibleName = accessibleNameFor(element);
  const interactionEffect = interactionEffectFor(element.interactionEffect);
  const disclosureIndependence = disclosureIndependenceFor(
    element.disclosureIndependence,
  );
  const recordStableId = normalizeText(element.recordStableId);
  const controlKey = [
    element.role,
    encodeURIComponent(accessibleName || "(unnamed)"),
    String(occurrence),
  ].join(":");
  return {
    controlKey,
    domOrderKey: `${String(order).padStart(ORDER_WIDTH, "0")}:${controlKey}`,
    order,
    role: element.role,
    accessibleName,
    enabled: !element.disabled,
    disabled: element.disabled,
    visible: element.visible,
    tagName: element.tagName,
    inputType: element.inputType,
    href: element.href,
    ariaControls: element.ariaControls,
    ariaExpanded: element.ariaExpanded,
    ...(disclosureIndependence === undefined ? {} : { disclosureIndependence }),
    ...(recordStableId === "" ? {} : { recordStableId }),
    ...(interactionEffect === undefined ? {} : { interactionEffect }),
    ...(element.keyboardExpectedFocusable === undefined
      ? {}
      : { keyboardExpectedFocusable: element.keyboardExpectedFocusable }),
    ...(element.keyboardFocusPolicy === undefined
      ? {}
      : { keyboardFocusPolicy: element.keyboardFocusPolicy }),
    ...(element.keyboardFocusScope === undefined
      ? {}
      : { keyboardFocusScope: element.keyboardFocusScope }),
  };
};

const issuesFor = (
  controls: readonly DomControlObservation[],
): readonly DomInventoryIssue[] =>
  controls
    .filter((control) => control.accessibleName === "")
    .map((control) => ({
      kind: "missing-accessible-name",
      controlKey: control.controlKey,
      message: `Visible ${control.role} is missing an accessible name`,
    }));

const isNavigationContextLoss = (error: unknown): boolean =>
  error instanceof Error &&
  /Execution context was destroyed.*navigation/iu.test(error.message);

const inventoryElements = async (
  page: Page,
  attempts = INVENTORY_CONTEXT_ATTEMPTS,
): Promise<RawInventoryResult> => {
  try {
    return await page.evaluate<RawInventoryResult>(INVENTORY_SCRIPT);
  } catch (error: unknown) {
    if (attempts <= 1 || !isNavigationContextLoss(error)) {
      throw error;
    }
    await page.waitForLoadState("domcontentloaded");
    return inventoryElements(page, attempts - 1);
  }
};

export async function inventoryDom(page: Page): Promise<DomInventory> {
  const rawResult = await inventoryElements(page);
  const rawElements = isRawInventoryObject(rawResult)
    ? rawResult.elements
    : rawResult;
  const controls = rawElements.map((element, index) => {
    const occurrence =
      rawElements
        .slice(0, index)
        .filter(
          (other) =>
            other.role === element.role &&
            accessibleNameFor(other) === accessibleNameFor(element),
        ).length + 1;
    return controlFrom(element, index + 1, occurrence);
  });
  return {
    controls,
    issues: issuesFor(controls),
    ...(isRawInventoryObject(rawResult)
      ? { visibleText: normalizeText(rawResult.visibleText) }
      : {}),
  };
}
