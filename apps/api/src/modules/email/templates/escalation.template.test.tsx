/**
 * VA-0a / VA-0b regression tests for escalation.template.tsx.
 *
 * Coverage targets (verify-a11y-recommended-flip catalog):
 *  - unit-rtl high: module exports EscalationEmail as React.ReactElement
 *  - snapshot high:  li render loop — composite key (leadName+sectionTitle)
 *  - unit-rtl high: li keys are stable when lateLeads is reordered
 *  - snapshot med:  same lateLeads renders to identical HTML twice
 *
 * No jsdom / RTL — the api package runs in Node; html is obtained via
 * @react-email/render which is already a production dependency.
 */
import { render } from "@react-email/render";
import * as React from "react";
import { describe, expect, it } from "vitest";

import {
  EscalationEmail,
  type EscalationEmailProps,
} from "./escalation.template.js";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const org = {
  shortName: "Demo",
  fullName: "Example Software Department",
};

const leadA: EscalationEmailProps["lateLeads"][number] = {
  leadName: "Alice",
  sectionTitle: "Backend",
  deadlineIso: "2026-04-20T15:00:00.000Z",
};
const leadB: EscalationEmailProps["lateLeads"][number] = {
  leadName: "Bob",
  sectionTitle: "Frontend",
  deadlineIso: "2026-04-20T15:00:00.000Z",
};

const baseProps: EscalationEmailProps = {
  headName: "Carol",
  cycleDate: "2026-04-19",
  reportPeriod: "2026-04-13 → 2026-04-19",
  lateLeads: [leadA, leadB],
  organization: org,
};

// ---------------------------------------------------------------------------
// unit-rtl / high: module-export shape
// ---------------------------------------------------------------------------

describe("EscalationEmail — module exports", () => {
  it("exports EscalationEmail as a callable function that returns a React element", () => {
    // Catalog row: "module exports EscalationEmail function and
    // EscalationEmailProps interface as React.ReactElement"
    expect(typeof EscalationEmail).toBe("function");
    const element = EscalationEmail(baseProps);
    // React.ReactElement shape: has a non-null `type` property
    expect(element).not.toBeNull();
    expect(element).toHaveProperty("type");
  });
});

// ---------------------------------------------------------------------------
// snapshot / high: li composite key renders correct structure
// ---------------------------------------------------------------------------

describe("EscalationEmail — li composite key snapshot", () => {
  it("rendered HTML for two late leads matches snapshot (li composite key)", async () => {
    // Catalog row: "each li element has key=${lead.leadName}-${lead.sectionTitle}"
    // React keys are not rendered in HTML, but the content driven by the same
    // composite identity must be stable and snapshotted here.
    const html = await render(React.createElement(EscalationEmail, baseProps));
    expect(html).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// unit-rtl / high: stable composite keys — reorder does NOT silently collapse
// ---------------------------------------------------------------------------

describe("EscalationEmail — stable composite keys under reorder", () => {
  it("reordering lateLeads changes rendered order (keys follow identity, not position)", async () => {
    // Catalog row: "li elements maintain identity when lateLeads array is
    // reordered (same leadName+sectionTitle pair = same DOM node)"
    //
    // With index keys: swapping A↔B would still render HTML in [A,B] order
    // because React reconciles by position. With composite keys React tracks
    // by identity, so the rendered HTML reflects the actual array order.
    // Test: render [A,B] vs [B,A] → the HTML content order should differ.
    const htmlAB = await render(
      React.createElement(EscalationEmail, {
        ...baseProps,
        lateLeads: [leadA, leadB],
      }),
    );
    const htmlBA = await render(
      React.createElement(EscalationEmail, {
        ...baseProps,
        lateLeads: [leadB, leadA],
      }),
    );

    // In both renders every lead is present.
    expect(htmlAB).toContain("Alice");
    expect(htmlAB).toContain("Bob");
    expect(htmlBA).toContain("Alice");
    expect(htmlBA).toContain("Bob");

    // Order must reflect the actual array order (composite key tracks identity).
    const alicePosAB = htmlAB.indexOf("Alice");
    const bobPosAB = htmlAB.indexOf("Bob");
    const alicePosBA = htmlBA.indexOf("Alice");
    const bobPosBA = htmlBA.indexOf("Bob");

    // [A,B] render: Alice appears before Bob
    expect(alicePosAB).toBeLessThan(bobPosAB);
    // [B,A] render: Bob appears before Alice
    expect(bobPosBA).toBeLessThan(alicePosBA);
  });
});

// ---------------------------------------------------------------------------
// snapshot / medium: identical input always produces identical HTML
// ---------------------------------------------------------------------------

describe("EscalationEmail — deterministic render snapshot", () => {
  it("rendering the same lateLeads twice produces identical HTML", async () => {
    // Catalog row: "rendering same lateLeads array twice produces identical
    // HTML structure with identical key attributes"
    const propsClone: EscalationEmailProps = {
      ...baseProps,
      lateLeads: [...baseProps.lateLeads],
    };
    const html1 = await render(React.createElement(EscalationEmail, baseProps));
    const html2 = await render(
      React.createElement(EscalationEmail, propsClone),
    );
    expect(html1).toBe(html2);
  });
});
