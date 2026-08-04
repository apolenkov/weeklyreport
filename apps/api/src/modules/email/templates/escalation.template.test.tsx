import * as React from "react";
import { render } from "react-email";
import { describe, expect, it } from "vitest";

import {
  EscalationEmail,
  escalationEmailPlaintext,
  type EscalationEmailProps,
} from "./escalation.template.js";

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

describe("EscalationEmail — rendered template contract", () => {
  it("renders the recipient, report period, late leads, and organization brand", async () => {
    const html = await render(React.createElement(EscalationEmail, baseProps));

    expect(html).toContain("Carol");
    expect(html).toContain("2026-04-13 → 2026-04-19");
    expect(html).toContain("Alice");
    expect(html).toContain("Backend");
    expect(html).toContain("Bob");
    expect(html).toContain("Frontend");
    expect(html).toContain("Example Software Department");
  });
});

describe("EscalationEmail — li rendering", () => {
  it("rendered HTML for two late leads matches snapshot", async () => {
    const html = await render(React.createElement(EscalationEmail, baseProps));
    expect(html).toMatchSnapshot();
  });
});

describe("EscalationEmail — render order follows input order", () => {
  it("reordering lateLeads changes the rendered HTML order to match", async () => {
    // Static render has no key reconciliation — only pins HTML order vs input order.
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

    expect(htmlAB).toContain("Alice");
    expect(htmlAB).toContain("Bob");
    expect(htmlBA).toContain("Alice");
    expect(htmlBA).toContain("Bob");

    const alicePosAB = htmlAB.indexOf("Alice");
    const bobPosAB = htmlAB.indexOf("Bob");
    const alicePosBA = htmlBA.indexOf("Alice");
    const bobPosBA = htmlBA.indexOf("Bob");

    expect(alicePosAB).toBeLessThan(bobPosAB);
    expect(bobPosBA).toBeLessThan(alicePosBA);
  });
});

describe("EscalationEmail — deterministic render snapshot", () => {
  it("rendering the same lateLeads twice produces identical HTML", async () => {
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

describe("escalationEmailPlaintext — literal output", () => {
  it("uses plural 'leads have' phrasing for multiple late leads", () => {
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
        "The following lead has not submitted their section of the 2026-04-13 → 2026-04-19 weekly report (2026-04-19):",
        "",
        "  - Alice — Backend (deadline 2026-04-20T15:00:00.000Z)",
        "",
        "— Demo (Weekly status reporting for Example Software Department)",
      ].join("\n"),
    );
  });

  it("renders the singular 'lead has' phrasing in the HTML branch too", async () => {
    const html = await render(
      React.createElement(EscalationEmail, {
        ...baseProps,
        lateLeads: [leadA],
      }),
    );
    const text = html.replaceAll("<!-- -->", "");
    expect(text).toContain(
      "the following lead has not submitted their section of the",
    );
    expect(text).not.toContain("lead have");
  });
});
