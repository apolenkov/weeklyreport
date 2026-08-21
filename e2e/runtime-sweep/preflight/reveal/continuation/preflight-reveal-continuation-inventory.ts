import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import type { SerializableRevealInventory } from "./preflight-reveal-continuation-schemas.ts";

const serializableCache = new WeakMap<object, SerializableRevealInventory>();

export const serializableInventoryFor = (
  inventory: DomInventory,
): SerializableRevealInventory => {
  const cached = serializableCache.get(inventory);
  if (cached !== undefined) return cached;
  const serialized: SerializableRevealInventory = {
    controls: inventory.controls.map((control) => ({
      controlKey: control.controlKey,
      domOrderKey: control.domOrderKey,
      order: control.order,
      role: control.role,
      accessibleName: control.accessibleName,
      enabled: control.enabled,
      disabled: control.disabled,
      visible: control.visible,
      tagName: control.tagName,
      inputType: control.inputType,
      href: control.href,
      ...(control.ariaControls === undefined
        ? {}
        : { ariaControls: control.ariaControls }),
      ...(control.ariaExpanded === undefined
        ? {}
        : { ariaExpanded: control.ariaExpanded }),
      ...(control.disclosureIndependence === undefined
        ? {}
        : { disclosureIndependence: control.disclosureIndependence }),
      ...(control.recordStableId === undefined
        ? {}
        : { recordStableId: control.recordStableId }),
      ...(control.interactionEffect === undefined
        ? {}
        : { interactionEffect: control.interactionEffect }),
      ...(control.keyboardExpectedFocusable === undefined
        ? {}
        : { keyboardExpectedFocusable: control.keyboardExpectedFocusable }),
      ...(control.keyboardFocusPolicy === undefined
        ? {}
        : { keyboardFocusPolicy: control.keyboardFocusPolicy }),
      ...(control.keyboardFocusScope === undefined
        ? {}
        : { keyboardFocusScope: control.keyboardFocusScope }),
    })),
    issues: inventory.issues,
    ...(inventory.visibleText === undefined
      ? {}
      : { visibleText: inventory.visibleText }),
  };
  serializableCache.set(inventory, serialized);
  return serialized;
};

export const domInventoryFor = (
  inventory: SerializableRevealInventory,
): DomInventory => ({
  controls: inventory.controls.map((control): DomControlObservation => ({
    controlKey: control.controlKey,
    domOrderKey: control.domOrderKey,
    order: control.order,
    role: control.role,
    accessibleName: control.accessibleName,
    enabled: control.enabled,
    disabled: control.disabled,
    visible: control.visible,
    tagName: control.tagName,
    inputType: control.inputType,
    href: control.href,
    ...(control.ariaControls === undefined
      ? {}
      : { ariaControls: control.ariaControls }),
    ...(control.ariaExpanded === undefined
      ? {}
      : { ariaExpanded: control.ariaExpanded }),
    ...(control.disclosureIndependence === undefined
      ? {}
      : { disclosureIndependence: control.disclosureIndependence }),
    ...(control.recordStableId === undefined
      ? {}
      : { recordStableId: control.recordStableId }),
    ...(control.interactionEffect === undefined
      ? {}
      : { interactionEffect: control.interactionEffect }),
    ...(control.keyboardExpectedFocusable === undefined
      ? {}
      : { keyboardExpectedFocusable: control.keyboardExpectedFocusable }),
    ...(control.keyboardFocusPolicy === undefined
      ? {}
      : { keyboardFocusPolicy: control.keyboardFocusPolicy }),
    ...(control.keyboardFocusScope === undefined
      ? {}
      : { keyboardFocusScope: control.keyboardFocusScope }),
  })),
  issues: inventory.issues,
  ...(inventory.visibleText === undefined
    ? {}
    : { visibleText: inventory.visibleText }),
});
