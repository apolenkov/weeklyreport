import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAppLogger, createNullLogger } from './logger';

describe('createAppLogger', () => {
  let logDir: string;

  beforeEach(() => {
    logDir = mkdtempSync(join(tmpdir(), 'logger-test-'));
  });

  afterEach(() => {
    rmSync(logDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('writes info entry to stdout as JSON', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const logger = createAppLogger({ minLevel: 'info' });

    logger.info('hello');

    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed).toMatchObject({ level: 'info', message: 'hello' });
    expect(parsed.timestamp).toBeDefined();
  });

  it('writes error entry to stderr', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const logger = createAppLogger({ minLevel: 'info' });

    logger.error('fail');

    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed).toMatchObject({ level: 'error', message: 'fail' });
  });

  it('suppresses messages below minLevel', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const logger = createAppLogger({ minLevel: 'warn' });

    logger.debug('too low');
    logger.info('still too low');

    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('includes service name in every entry', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const logger = createAppLogger({ service: 'test-svc' });

    logger.info('with service');

    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed.service).toBe('test-svc');
  });

  it('merges context into log entry', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const logger = createAppLogger();

    logger.info('request', { method: 'GET', path: '/api' });

    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed.method).toBe('GET');
    expect(parsed.path).toBe('/api');
  });

  it('appends structured JSON lines to daily log file', () => {
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const logger = createAppLogger({ logDir, service: 'file-test' });

    logger.info('first');
    logger.info('second');

    const files = readdirSync(logDir).filter((f) => f.endsWith('.log'));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^customreport-\d{4}-\d{2}-\d{2}\.log$/);

    const lines = readFileSync(join(logDir, files[0]!), 'utf-8')
      .trim()
      .split('\n');
    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0]!);
    expect(first).toMatchObject({ level: 'info', message: 'first', service: 'file-test' });
  });

  it('prunes old log files beyond maxFiles', () => {
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    // Pre-create 3 old log files
    writeFileSync(join(logDir, 'customreport-2026-01-01.log'), 'old1\n');
    writeFileSync(join(logDir, 'customreport-2026-01-02.log'), 'old2\n');
    writeFileSync(join(logDir, 'customreport-2026-01-03.log'), 'old3\n');

    const logger = createAppLogger({ logDir, maxFiles: 2 });
    logger.info('new entry');

    const remaining = readdirSync(logDir)
      .filter((f) => f.endsWith('.log'))
      .sort();

    // maxFiles=2: after writing today's file (4 total), prune oldest 2
    expect(remaining.length).toBeLessThanOrEqual(2);
  });

  it('creates logDir if it does not exist', () => {
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const nestedDir = join(logDir, 'nested', 'deep');

    const logger = createAppLogger({ logDir: nestedDir });
    logger.info('nested test');

    const files = readdirSync(nestedDir);
    expect(files.length).toBeGreaterThan(0);
  });
});

describe('child logger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('inherits parent context and adds its own', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const parent = createAppLogger({ service: 'api' });
    const child = parent.child({ module: 'reminders' });

    child.info('reminder sent');

    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed.service).toBe('api');
    expect(parsed.module).toBe('reminders');
    expect(parsed.message).toBe('reminder sent');
  });

  it('preserves parent minLevel', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const parent = createAppLogger({ minLevel: 'warn' });
    const child = parent.child({ module: 'test' });

    child.info('should be suppressed');

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('createNullLogger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does not write to stdout or stderr', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const logger = createNullLogger();

    logger.debug('noop');
    logger.info('noop');
    logger.warn('noop');
    logger.error('noop');

    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('child returns itself', () => {
    const logger = createNullLogger();
    const child = logger.child({ key: 'value' });

    expect(child).toBe(logger);
  });
});
