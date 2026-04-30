import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { TrafficLightHistoryChart } from './traffic-light-history.chart';
import { LeadVelocityChart } from './lead-velocity.chart';
import { PeriodComparisonChart } from './period-comparison.chart';

describe('TrafficLightHistoryChart', () => {
  it('renders the empty-state message when no periods', () => {
    render(<TrafficLightHistoryChart periods={[]} rows={[]} />);
    expect(screen.getByText(/no published periods/i)).toBeInTheDocument();
  });

  it('renders without crash with sample data containing nulls', () => {
    render(
      <TrafficLightHistoryChart
        periods={['2026-04-21', '2026-04-28']}
        rows={[
          {
            projectId: '11111111-1111-4111-8111-111111111111',
            projectName: 'Alpha',
            statuses: ['green', null],
          },
        ]}
      />,
    );
    // ResponsiveContainer renders a wrapper div; assert basic mount.
    expect(document.body.querySelector('div')).toBeTruthy();
  });
});

describe('LeadVelocityChart', () => {
  it('renders the empty-state message when no rows', () => {
    render(<LeadVelocityChart rows={[]} />);
    expect(screen.getByText(/no velocity data/i)).toBeInTheDocument();
  });

  it('renders sample lead-velocity data without crash', () => {
    render(
      <LeadVelocityChart
        rows={[
          {
            periodLabel: '2026-04-21',
            leads: [
              { leadId: '00000000-0000-4000-8000-000000000001', leadName: 'L1', submittedSections: 1 },
            ],
          },
        ]}
      />,
    );
    expect(document.body.querySelector('div')).toBeTruthy();
  });
});

describe('PeriodComparisonChart', () => {
  it('renders the empty-state message when no rows', () => {
    render(<PeriodComparisonChart rows={[]} />);
    expect(screen.getByText(/no comparison data/i)).toBeInTheDocument();
  });

  it('renders null cells as em-dash and zero cells as 0 (CONTEXT D-3)', () => {
    render(
      <PeriodComparisonChart
        rows={[
          {
            projectId: '11111111-1111-4111-8111-111111111111',
            projectName: 'Alpha',
            statusA: null,
            statusB: 'green',
            riskCountA: 0,
            riskCountB: 0,
            riskDelta: 0,
          },
        ]}
      />,
    );
    // null status renders as em-dash
    expect(screen.getByText('–')).toBeInTheDocument();
    // zero risk count renders as the literal '0'
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });

  it('renders positive delta with + prefix and red colour class', () => {
    const { container } = render(
      <PeriodComparisonChart
        rows={[
          {
            projectId: '11111111-1111-4111-8111-111111111111',
            projectName: 'Alpha',
            statusA: 'green',
            statusB: 'red',
            riskCountA: 1,
            riskCountB: 4,
            riskDelta: 3,
          },
        ]}
      />,
    );
    expect(screen.getByText('+3')).toBeInTheDocument();
    const deltaCell = container.querySelector('.text-red-600');
    expect(deltaCell).not.toBeNull();
  });
});
