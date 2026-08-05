import { readFileSync } from "node:fs";

import type { Page } from "@playwright/test";
import { z } from "zod";

import type { EvidenceRef, PermissionBoundary } from "../source/contracts.ts";

export const LEAD_FORM_UNAVAILABLE_MARKER = Object.freeze({
  heading: "Report form unavailable",
  status:
    "This reporting period does not have an editable section for your account.",
});
const LEAD_FORM_UNAVAILABLE_KIND = "lead-form-unavailable" as const;

const surfaceMarkerObservationSchema = z
  .object({
    kind: z.literal(LEAD_FORM_UNAVAILABLE_KIND),
    present: z.boolean(),
    heading: z
      .object({
        text: z.string().nullable(),
        count: z.number().int().nonnegative(),
      })
      .strict(),
    status: z
      .object({
        text: z.string().nullable(),
        count: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

const runtimeSurfaceObservationSchema = z
  .object({
    productContent: z.enum(["available", "denied"]),
    productActions: z.enum(["exercise", "inapplicable"]),
    marker: surfaceMarkerObservationSchema,
  })
  .strict();

export type RuntimeSurfaceObservation = Readonly<
  z.infer<typeof runtimeSurfaceObservationSchema>
>;

export const EXPECTED_LEAD_FORM_UNAVAILABLE_SURFACE = Object.freeze({
  productContent: "denied",
  productActions: "inapplicable",
  marker: {
    kind: LEAD_FORM_UNAVAILABLE_KIND,
    present: true,
    heading: { text: LEAD_FORM_UNAVAILABLE_MARKER.heading, count: 1 },
    status: { text: LEAD_FORM_UNAVAILABLE_MARKER.status, count: 1 },
  },
});

export type RuntimeSurfaceExpectation = Readonly<{
  productContent: "available" | "denied";
  productActions: "exercise" | "inapplicable";
  productActionsReason: string | null;
  shell: "required";
}>;

const LEAD_FORM_ROUTE_KEYS: readonly string[] = Object.freeze([
  "lead:/lead/report",
  "lead:/lead/report/[reportId]",
] as const);
const LEAD_FORM_DENIED_PERMISSIONS: readonly PermissionBoundary[] =
  Object.freeze(["anonymous", "forbidden", "non-owner"] as const);
const LEAD_FORM_UNAVAILABLE_REASON =
  "The lead report form has no section for the current account.";

const normalizedText = (value: string): string =>
  value.replaceAll(/\s+/g, " ").trim();

const observedText = (values: readonly string[]): string | null =>
  values.length === 1 ? normalizedText(values[0] ?? "") : null;

export const observeRuntimeSurface = async (
  page: Page,
): Promise<RuntimeSurfaceObservation> => {
  const main = page.locator("#main-content");
  const headings = main.locator("h1");
  const statuses = main.getByRole("status");
  const [headingTexts, statusTexts] = await Promise.all([
    headings.allTextContents(),
    statuses.allTextContents(),
  ]);
  const headingText = observedText(headingTexts);
  const statusText = observedText(statusTexts);
  const markerPresent =
    headingTexts.length === 1 &&
    headingText === LEAD_FORM_UNAVAILABLE_MARKER.heading &&
    statusTexts.length === 1 &&
    statusText === LEAD_FORM_UNAVAILABLE_MARKER.status;
  return Object.freeze({
    productContent: markerPresent ? "denied" : "available",
    productActions: markerPresent ? "inapplicable" : "exercise",
    marker: {
      kind: LEAD_FORM_UNAVAILABLE_KIND,
      present: markerPresent,
      heading: { text: headingText, count: headingTexts.length },
      status: { text: statusText, count: statusTexts.length },
    },
  });
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const hasLiveUnavailableSurfaceProof = (
  refs: readonly EvidenceRef[],
  controlKey: string,
): boolean =>
  refs
    .filter(({ kind }) => kind === "control-action")
    .some((ref) => {
      try {
        const value: unknown = JSON.parse(
          readFileSync(ref.archivePath, "utf8"),
        );
        if (!isRecord(value) || !isRecord(value.outcome)) return false;
        if (
          value.outcome.controlKey !== controlKey ||
          value.outcome.status !== "not-exercised"
        )
          return false;
        const observation = runtimeSurfaceObservationSchema.safeParse(
          value.outcome.surfaceObservation,
        );
        return (
          observation.success &&
          observation.data.productContent === "denied" &&
          observation.data.productActions === "inapplicable" &&
          observation.data.marker.present &&
          observation.data.marker.heading.text ===
            LEAD_FORM_UNAVAILABLE_MARKER.heading &&
          observation.data.marker.heading.count === 1 &&
          observation.data.marker.status.text ===
            LEAD_FORM_UNAVAILABLE_MARKER.status &&
          observation.data.marker.status.count === 1
        );
      } catch (error: unknown) {
        if (error instanceof Error) return false;
        throw error;
      }
    });

export function runtimeSurfaceExpectation(input: {
  readonly route: string;
  readonly permission: PermissionBoundary;
}): RuntimeSurfaceExpectation {
  const denied =
    LEAD_FORM_ROUTE_KEYS.includes(input.route) &&
    LEAD_FORM_DENIED_PERMISSIONS.includes(input.permission);
  return Object.freeze({
    productContent: denied ? "denied" : "available",
    productActions: denied ? "inapplicable" : "exercise",
    productActionsReason: denied ? LEAD_FORM_UNAVAILABLE_REASON : null,
    shell: "required",
  });
}
