/**
 * Regression tests for escalation.template.tsx.
 *
 * Coverage targets:
 *  - unit-rtl high: module exports EscalationEmail as React.ReactElement
 *  - snapshot high:  li render loop — composite key (leadName+sectionTitle)
 *  - unit-rtl high: static render output follows lateLeads array order
 *  - snapshot med:  same lateLeads renders to identical HTML twice
 *
 * No jsdom / RTL — the api package runs in Node; html is obtained via
 * react-email's render, already a production dependency. `render()` is a
 * single, non-reconciling static render (no React commit/diff step), so a
 * key-identity claim (composite keys vs. index keys distinguishing on
 * reorder) cannot be tested from here — that needs a client-render harness
 * this package doesn't have. See the reorder test below for what a static
 * render CAN prove.
 */
import * as React from "react";
import { render } from "react-email";
import { describe, expect, it } from "vitest";

import {
  EscalationEmail,
  escalationEmailPlaintext,
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
// unit-rtl / high: static render output follows input array order
// ---------------------------------------------------------------------------

describe("EscalationEmail — render order follows input order", () => {
  it("reordering lateLeads changes the rendered HTML order to match", async () => {
    // This is a single, non-reconciling static render (react-email's
    // render()) — there is no commit/diff step where a `key` prop strategy
    // (composite vs. index) could matter. `map()` always emits its output in
    // array order regardless of `key`, so this only pins that claim: render
    // [A,B] vs [B,A] and the HTML content order follows the input order.
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

    // Order must reflect the actual input array order.
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

// ---------------------------------------------------------------------------
// unit / high: escalationEmailPlaintext exact-output pin
// ---------------------------------------------------------------------------

describe("escalationEmailPlaintext — literal output", () => {
  it("produces the exact literal plaintext body for baseProps", () => {
    expect(escalationEmailPlaintext(baseProps)).toBe(
      [
        "Hello Carol,",
        "",
        "The following leads have not submitted their section of the 2026-04-13 → 2026-04-19 weekly report (2026-04-19):",
        "",
        "  - Alice — Backend (deadline 2026-04-20T15:00:00.000Z)",
        "  - Bob — Frontend (deadline 2026-04-20T15:00:00.000Z)",
        "",
        "— Demo (Weekly status reporting for Example Software Department)",
      ].join("\n"),
    );
  });

  it("uses the singular 'lead' phrasing for exactly one late lead", () => {
    expect(escalationEmailPlaintext({ ...baseProps, lateLeads: [leadA] })).toBe(
      [
        "Hello Carol,",
        "",
        "The following lead have not submitted their section of the 2026-04-13 → 2026-04-19 weekly report (2026-04-19):",
        "",
        "  - Alice — Backend (deadline 2026-04-20T15:00:00.000Z)",
        "",
        "— Demo (Weekly status reporting for Example Software Department)",
      ].join("\n"),
    );
  });
});
