import { describe, expect, expectTypeOf, it } from "vitest";

import { omitUndefinedProperties } from "./omit-undefined-properties.js";

describe("omitUndefinedProperties", () => {
  it("keeps defined values and removes explicit undefined keys", () => {
    const protocolValue: {
      required: string;
      present: number | undefined;
      absent: number | undefined;
    } = {
      required: "value",
      present: 1,
      absent: undefined,
    };
    const result = omitUndefinedProperties(protocolValue);

    expect(result).toEqual({ required: "value", present: 1 });
    expect(Object.hasOwn(result, "absent")).toBe(false);
    expectTypeOf(result).toExtend<{
      required: string;
      present?: number;
      absent?: number;
    }>();
  });
});
