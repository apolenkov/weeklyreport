import { describe, expect, it, vi } from 'vitest';

import {
  buildClientErrorLogEntry,
  logClientError,
} from './client-error-reporting';

describe('client-error-reporting', () => {
  it('builds a stable log envelope for Error instances', () => {
    const error = new TypeError('Failed to load weekly report');

    expect(
      buildClientErrorLogEntry('weeklyReport.get.load_failed', error, {
        reportId: 'report-1',
      }),
    ).toEqual({
      event: 'weeklyReport.get.load_failed',
      message: 'Failed to load weekly report',
      name: 'TypeError',
      context: { reportId: 'report-1' },
    });
  });

  it('logs the original Error so the browser forwarder can capture stack', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Unexpected error');

    logClientError('weeklyReport.get.load_failed', error, {
      procedure: 'weeklyReport.get',
    });

    expect(spy).toHaveBeenCalledWith(
      '[weeklyReport.get.load_failed] Unexpected error',
      error,
      { procedure: 'weeklyReport.get' },
    );

    spy.mockRestore();
  });
});
