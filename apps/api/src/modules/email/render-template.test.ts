import { describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import { renderEmail } from "./render-template";

// UFB-047 / Phase 49-01: brand snapshot now travels with every Phase-28+
// payload. The renderer reads it; the BullMQ enqueue path snapshots it
// from `OrganizationService.getPublic()`.
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

describe('renderEmail — kind="deadline"', () => {
  it("renders non-empty html containing the lead name and section link", async () => {
    const out = await renderEmail({ kind: "deadline", props: baseProps });

    expect(out.html).toBeTruthy();
    expect(out.html).toContain("Lead Alpha");
    expect(out.html).toContain("lead/report?reportId=abc-123");
  });

  it("renders non-empty plaintext mirroring the html body", async () => {
    const out = await renderEmail({ kind: "deadline", props: baseProps });

    expect(out.text).toBeTruthy();
    expect(out.text).toContain("Hi Lead Alpha");
    expect(out.text).toContain(
      "http://localhost:3000/lead/report?reportId=abc-123",
    );
    expect(out.text).toContain("2026-04-13 → 2026-04-19");
  });

  it("produces a subject containing the report period and 24h cue", async () => {
    const out = await renderEmail({ kind: "deadline", props: baseProps });

    expect(out.subject).toContain("2026-04-13");
    expect(out.subject).toMatch(/24h/i);
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

// NOTIF-02 (Phase 29-05): T+2h escalation digest renders all late leads
// into ONE multipart email — never one email per lead.
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
});
