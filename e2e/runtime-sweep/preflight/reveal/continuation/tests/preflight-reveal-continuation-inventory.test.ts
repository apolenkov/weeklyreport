import { describe, expect, it } from "vitest";

import {
  inventoryAssetSchema,
  PREFLIGHT_REVEAL_CONTINUATION_VERSION,
  PREFLIGHT_REVEAL_INVENTORY,
} from "../contracts/preflight-reveal-continuation-schemas.ts";
import { inventoryFor } from "../preflight-reveal-continuation-fixture.ts";
import {
  domInventoryFor,
  serializableInventoryFor,
} from "../preflight-reveal-continuation-inventory.ts";

const RECORD_STABLE_ID = "88888888-8888-4888-8888-888888888888";
const DIGEST = "a".repeat(64);
const control = {
  controlKey: "button:Edit%20decision:1",
  domOrderKey: "0001:button:Edit%20decision:1",
  order: 1,
  role: "button",
  accessibleName: "Edit decision",
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
} as const;

describe("R197 continuation inventory lineage contract", () => {
  it("round-trips UUID lineage and omits absent lineage", () => {
    const serialized = serializableInventoryFor(
      inventoryFor([{ ...control, recordStableId: RECORD_STABLE_ID }, control]),
    );

    expect(
      serialized.controls.map(({ recordStableId }) => recordStableId),
    ).toEqual([RECORD_STABLE_ID, undefined]);
    expect(domInventoryFor(serialized)).toEqual(
      inventoryFor([{ ...control, recordStableId: RECORD_STABLE_ID }, control]),
    );
  });

  it("round-trips scoped disclosure metadata", () => {
    const disclosure = {
      ...control,
      ariaControls: "panel-a",
      ariaExpanded: false,
      disclosureIndependence: "source-bound-row-local",
    } as const;

    const serialized = serializableInventoryFor(inventoryFor([disclosure]));

    expect(serialized.controls[0]).toMatchObject({
      ariaControls: "panel-a",
      ariaExpanded: false,
      disclosureIndependence: "source-bound-row-local",
    });
    expect(domInventoryFor(serialized)).toEqual(inventoryFor([disclosure]));
  });

  it("fails closed on malformed lineage and legacy v4 inventory assets", () => {
    const body = {
      artifact: PREFLIGHT_REVEAL_INVENTORY,
      version: PREFLIGHT_REVEAL_CONTINUATION_VERSION,
      digest: DIGEST,
      inventory: serializableInventoryFor(
        inventoryFor([{ ...control, recordStableId: RECORD_STABLE_ID }]),
      ),
    };

    expect(inventoryAssetSchema.safeParse(body).success).toBe(true);
    expect(
      inventoryAssetSchema.safeParse({
        ...body,
        inventory: {
          ...body.inventory,
          controls: [
            { ...body.inventory.controls[0], recordStableId: "legacy" },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      inventoryAssetSchema.safeParse({ ...body, version: 4 }).success,
    ).toBe(false);
    expect(PREFLIGHT_REVEAL_CONTINUATION_VERSION).toBe(5);
  });
});
