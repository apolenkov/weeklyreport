import { describe, expect, it } from 'vitest';

import { renderEmail } from './render-template';

const baseProps = {
  leadName: 'Lead Alpha',
  reportPeriod: '2026-04-13 → 2026-04-19',
  deadlineIso: '2026-04-20T15:00:00.000Z',
  sectionUrl: 'http://localhost:3000/lead/report?reportId=abc-123',
};

describe('renderEmail — kind="deadline"', () => {
  it('renders non-empty html containing the lead name and section link', async () => {
    const out = await renderEmail({ kind: 'deadline', props: baseProps });

    expect(out.html).toBeTruthy();
    expect(out.html).toContain('Lead Alpha');
    expect(out.html).toContain('lead/report?reportId=abc-123');
  });

  it('renders non-empty plaintext mirroring the html body', async () => {
    const out = await renderEmail({ kind: 'deadline', props: baseProps });

    expect(out.text).toBeTruthy();
    expect(out.text).toContain('Hi Lead Alpha');
    expect(out.text).toContain('http://localhost:3000/lead/report?reportId=abc-123');
    expect(out.text).toContain('2026-04-13 → 2026-04-19');
  });

  it('produces a subject containing the report period and 24h cue', async () => {
    const out = await renderEmail({ kind: 'deadline', props: baseProps });

    expect(out.subject).toContain('2026-04-13');
    expect(out.subject).toMatch(/24h/i);
  });

  it('html and text are non-empty for minimal-length names', async () => {
    const out = await renderEmail({
      kind: 'deadline',
      props: { ...baseProps, leadName: 'A', reportPeriod: 'X' },
    });

    expect(out.html.length).toBeGreaterThan(50);
    expect(out.text.length).toBeGreaterThan(20);
  });
});
