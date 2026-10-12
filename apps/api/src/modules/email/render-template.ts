import type { OrganizationBrand } from "@weeklyreport/shared";

interface DeadlineEmailProps {
  leadName: string;
  reportPeriod: string; // e.g. "2026-W17" or "2026-04-13 to 2026-04-19"
  deadlineIso: string;
  sectionUrl: string; // deep link to /lead/report
  organization: OrganizationBrand;
}

// Per-head late-leads digest; opt-out / timing / dedupe live on the scheduler path.
interface EscalationEmailProps {
  headName: string;
  cycleDate: string; // YYYY-MM-DD UTC
  reportPeriod: string; // human-readable e.g. "2026-04-13 → 2026-04-19"
  lateLeads: readonly {
    readonly leadName: string;
    readonly sectionTitle: string;
    readonly deadlineIso: string;
  }[];
  organization: OrganizationBrand;
}

// Multipart subject+html+text — spam filters score multipart over HTML-only.
export type EmailRenderInput =
  | { kind: "deadline"; props: DeadlineEmailProps }
  | { kind: "escalation"; props: EscalationEmailProps };

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

// Every interpolated value — names, periods, URLs, titles — passes through
// here: the recipient's mail client renders this HTML.
const escapeHtml = (value: string): string =>
  value.replaceAll(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);

const formatDeadline = (iso: string): string =>
  `${new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso))} UTC`;

// Hidden inbox preview text (what react-email's <Preview> emitted).
const page = (title: string, preview: string, body: string): string =>
  [
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title></head>`,
    `<body style="background-color:#f9fafb;font-family:sans-serif"><div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">${escapeHtml(preview)}</div>`,
    `<div style="max-width:36rem;margin:0 auto;background-color:#ffffff;padding:2rem;border-radius:0.5rem">${body}</div></body></html>`,
  ].join("");

// Only web links may reach an href; anything else is a caller bug, not
// something to silently rewrite.
const safeHref = (url: string): string => {
  const { protocol } = new URL(url);
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error(`Email link must be http(s), got ${protocol}`);
  }
  return escapeHtml(url);
};

const footerHtml = ({ shortName, fullName }: OrganizationBrand): string =>
  `<p style="font-size:0.875rem;color:#6a7282">${escapeHtml(shortName)} — Weekly status reporting for ${escapeHtml(fullName)}.</p>`;

const footerText = ({ shortName, fullName }: OrganizationBrand): string =>
  `— ${shortName} (Weekly status reporting for ${fullName})`;

function renderDeadline(props: DeadlineEmailProps): RenderedEmail {
  const { leadName, reportPeriod, deadlineIso, sectionUrl, organization } =
    props;
  const deadline = formatDeadline(deadlineIso);
  const html = page(
    "Weekly status report section deadline reminder",
    "Weekly status report section deadline reminder",
    [
      `<h1 style="font-size:1.25rem;color:#101828">Hi ${escapeHtml(leadName)}, please complete your report section</h1>`,
      `<p style="color:#364153">This is a reminder that your section of the ${escapeHtml(reportPeriod)} weekly status report is due by ${escapeHtml(deadline)}.</p>`,
      `<p><a href="${safeHref(sectionUrl)}" style="display:inline-block;background-color:#155dfc;color:#ffffff;padding:12px 20px;border-radius:0.25rem;text-decoration:none">Open my section</a></p>`,
      footerHtml(organization),
    ].join(""),
  );
  const text = [
    `Hi ${leadName},`,
    "",
    `This is a reminder that your section of the ${reportPeriod} weekly status report is due by ${deadline}.`,
    "",
    `Open your section: ${sectionUrl}`,
    "",
    footerText(organization),
  ].join("\n");
  // Subject prefixes the org `shortName` so the recipient's inbox folder
  // rules can grep on the brand without parsing the long-form name.
  const subject = `[${organization.shortName}] Reminder: ${reportPeriod} report section deadline`;
  return { subject, html, text };
}

function renderEscalation(props: EscalationEmailProps): RenderedEmail {
  const { headName, cycleDate, reportPeriod, lateLeads, organization } = props;
  const count = lateLeads.length;
  const one = count === 1;
  const html = page(
    `${count} late report section(s) on ${cycleDate}`,
    `${count} late report section(s) on ${cycleDate}`,
    [
      `<h1 style="font-size:1.25rem;color:#101828">Late draft sections — ${escapeHtml(cycleDate)}</h1>`,
      `<p style="color:#364153">Hello ${escapeHtml(headName)}, the following lead${one ? "" : "s"} ${one ? "has" : "have"} not submitted their section of the ${escapeHtml(reportPeriod)} weekly report:</p>`,
      `<ul style="color:#1e2939">${lateLeads
        .map(
          (lead) =>
            `<li><strong>${escapeHtml(lead.leadName)}</strong> — ${escapeHtml(lead.sectionTitle)} (deadline ${escapeHtml(lead.deadlineIso)})</li>`,
        )
        .join("")}</ul>`,
      footerHtml(organization),
    ].join(""),
  );
  const text = [
    `Hello ${headName},`,
    "",
    `The following lead${one ? "" : "s"} ${one ? "has" : "have"} not submitted their section of the ${reportPeriod} weekly report (${cycleDate}):`,
    "",
    ...lateLeads.map(
      (lead) =>
        `  - ${lead.leadName} — ${lead.sectionTitle} (deadline ${lead.deadlineIso})`,
    ),
    "",
    footerText(organization),
  ].join("\n");
  const subject = `[${organization.shortName}] Action required: ${count} late report section${one ? "" : "s"} (${cycleDate})`;
  return { subject, html, text };
}

export function renderEmail(input: EmailRenderInput): Promise<RenderedEmail> {
  try {
    return Promise.resolve(
      input.kind === "deadline"
        ? renderDeadline(input.props)
        : renderEscalation(input.props),
    );
  } catch (error) {
    return Promise.reject(error);
  }
}
