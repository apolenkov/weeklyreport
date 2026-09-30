import { describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import { renderEmail } from "./render-template";

// A brand snapshot travels with every email payload. The renderer reads
// it; the BullMQ enqueue path snapshots it from `OrganizationService.getPublic()`.
const organization = {
  shortName: "Demo",
  fullName: "Example Software Department",
};

const baseProps = {
  leadName: "Lead Alpha",
  reportPeriod: "2026-04-13 → 2026-04-19",
  deadlineIso: "2026-04-20T15:00:00.000Z",
  sectionUrl: "http://localhost:3000/lead/report?reportId=abc-123",
  organization,
};

const formattedDeadline = "April 20, 2026 at 3:00 PM UTC";

describe('renderEmail — kind="deadline"', () => {
  it("renders non-empty html containing the lead name and section link", async () => {
    const out = await renderEmail({ kind: "deadline", props: baseProps });

    expect(out.html).toBeTruthy();
    expect(out.html).toContain("Lead Alpha");
    expect(out.html).toContain("lead/report?reportId=abc-123");
    expect(out.html).toContain(formattedDeadline);
  });

  it("renders non-empty plaintext mirroring the html body", async () => {
    const out = await renderEmail({ kind: "deadline", props: baseProps });

    expect(out.text).toBeTruthy();
    expect(out.text).toContain("Hi Lead Alpha");
    expect(out.text).toContain(
      "http://localhost:3000/lead/report?reportId=abc-123",
    );
    expect(out.text).toContain("2026-04-13 → 2026-04-19");
    expect(out.text).toContain(formattedDeadline);
  });

  it("states the exact deadline without assuming a policy offset", async () => {
    const out = await renderEmail({ kind: "deadline", props: baseProps });

    expect(out.subject).toMatch(/^\[Demo\]/);
    expect(out.subject).toContain("2026-04-13");
    expect(`${out.subject}\n${out.html}\n${out.text}`).not.toMatch(
      /24\s*(?:h|hours?)/i,
    );
    expect(out.html).toContain(formattedDeadline);
    expect(out.text).toContain(formattedDeadline);
  });

  it("html and text are non-empty for minimal-length names", async () => {
    const out = await renderEmail({
      kind: "deadline",
      props: { ...baseProps, leadName: "A", reportPeriod: "X" },
    });

    expect(out.html.length).toBeGreaterThan(50);
    expect(out.text.length).toBeGreaterThan(20);
  });
});

// T+2h escalation digest renders all late leads into ONE multipart email —
// never one email per lead.
describe('renderEmail — kind="escalation"', () => {
  const escalationProps = {
    headName: "Department Head",
    cycleDate: "2026-04-19",
    reportPeriod: "2026-04-13 → 2026-04-19",
    organization,
    lateLeads: [
      {
        leadName: "Lead Alpha",
        sectionTitle: "Backend section",
        deadlineIso: "2026-04-19T15:00:00.000Z",
      },
      {
        leadName: "Lead Beta",
        sectionTitle: "Frontend section",
        deadlineIso: "2026-04-19T15:00:00.000Z",
      },
      {
        leadName: "Lead Gamma",
        sectionTitle: "Infra section",
        deadlineIso: "2026-04-19T15:00:00.000Z",
      },
    ],
  };

  it("html aggregates ALL late leads into one body (digest, not per-lead)", async () => {
    const out = await renderEmail({
      kind: "escalation",
      props: escalationProps,
    });

    expect(out.html).toContain("Lead Alpha");
    expect(out.html).toContain("Lead Beta");
    expect(out.html).toContain("Lead Gamma");
    expect(out.html).toContain("Department Head");
    expect(out.html).toContain("2026-04-19");
  });

  it("plaintext mirrors the html digest with all lead names", async () => {
    const out = await renderEmail({
      kind: "escalation",
      props: escalationProps,
    });

    expect(out.text).toContain("Lead Alpha");
    expect(out.text).toContain("Lead Beta");
    expect(out.text).toContain("Lead Gamma");
    expect(out.text).toContain("Department Head");
  });

  it("subject reports the late-lead count and cycle date", async () => {
    const out = await renderEmail({
      kind: "escalation",
      props: escalationProps,
    });

    expect(out.subject).toMatch(/^\[Demo\]/);
    expect(out.subject).toContain("3 late report sections");
    expect(out.subject).toContain("2026-04-19");
  });

  it('subject pluralisation: 1 lead drops the trailing "s"', async () => {
    const out = await renderEmail({
      kind: "escalation",
      props: {
        ...escalationProps,
        lateLeads: [expectDefined(escalationProps.lateLeads[0])],
      },
    });

    expect(out.subject).toContain("1 late report section ");
    expect(out.subject).not.toContain("1 late report sections");
  });

  it("keeps late leads in input order and uses the singular phrasing for one", async () => {
    const [alpha, beta] = escalationProps.lateLeads;
    const out = await renderEmail({
      kind: "escalation",
      props: {
        ...escalationProps,
        lateLeads: [expectDefined(beta), expectDefined(alpha)],
      },
    });
    expect(out.html.indexOf("Lead Beta")).toBeLessThan(
      out.html.indexOf("Lead Alpha"),
    );

    const single = await renderEmail({
      kind: "escalation",
      props: { ...escalationProps, lateLeads: [expectDefined(alpha)] },
    });
    expect(single.html).toContain("the following lead has not submitted");
    expect(single.text).toContain("The following lead has not submitted");
  });
});

// Trust boundary: the HTML is rendered by the recipient's mail client, so
// every interpolated value must arrive escaped.
describe("renderEmail — HTML escaping of interpolated values", () => {
  const hostile = `<script>alert("x")</script>&'`;
  const escaped = "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;";
  const evilOrg = { shortName: hostile, fullName: hostile };

  const expectEscaped = (html: string, occurrences: number): void => {
    expect(html).not.toContain("<script>");
    expect(html).not.toContain(hostile);
    expect(html.split(escaped)).toHaveLength(occurrences + 1);
  };

  it("escapes every deadline field", async () => {
    const out = await renderEmail({
      kind: "deadline",
      props: {
        leadName: hostile,
        reportPeriod: hostile,
        deadlineIso: "2026-04-20T15:00:00.000Z",
        sectionUrl: `http://localhost/?q=${hostile}`,
        organization: evilOrg,
      },
    });

    // leadName, reportPeriod, sectionUrl, shortName, fullName
    expectEscaped(out.html, 5);
    expect(out.html).toContain('href="http://localhost/?q=&lt;script');
  });

  it("escapes every escalation field", async () => {
    const out = await renderEmail({
      kind: "escalation",
      props: {
        headName: hostile,
        cycleDate: hostile,
        reportPeriod: hostile,
        lateLeads: [
          { leadName: hostile, sectionTitle: hostile, deadlineIso: hostile },
        ],
        organization: evilOrg,
      },
    });

    // <title> and heading cycleDate, headName, reportPeriod, leadName,
    // sectionTitle, deadlineIso, shortName, fullName
    expectEscaped(out.html, 9);
  });

  it("leaves the plaintext part unescaped", async () => {
    const out = await renderEmail({
      kind: "escalation",
      props: {
        headName: "A & B",
        cycleDate: "2026-04-19",
        reportPeriod: "P",
        lateLeads: [
          { leadName: "L", sectionTitle: "S", deadlineIso: "2026-04-19" },
        ],
        organization,
      },
    });

    expect(out.text).toContain("Hello A & B,");
    expect(out.text).toContain("Example Software Department");
  });
});
