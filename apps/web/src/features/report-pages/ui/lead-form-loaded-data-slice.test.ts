import type { ComponentProps } from "react";
import { describe, expectTypeOf, it } from "vitest";

import { LeadFormLoaded, type LeadFormLoadedData } from "./lead-form-loaded";

// Prop-seam guard: the `data` prop MUST be the declared LeadFormLoadedData
// slice. This is a type-level contract — a seam drift is a compile error, not
// a formatting-sensitive source regex. The companion ban on
// `ReturnType<typeof useX>` types stays in eslint.config.ts.
describe("lead-form data seam — type contract", () => {
  it("binds LeadFormLoaded.data to the declared LeadFormLoadedData slice", () => {
    expectTypeOf<
      ComponentProps<typeof LeadFormLoaded>["data"]
    >().toEqualTypeOf<LeadFormLoadedData>();
  });

  it("declares LeadFormLoadedData with a readonly shape", () => {
    expectTypeOf<LeadFormLoadedData>().toExtend<{
      readonly byPeriodData:
        { readonly section: { reportId: string } } | undefined;
    }>();
  });
});
