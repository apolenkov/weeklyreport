import { describe, it, expect } from 'vitest';
import { buildItems, classifyCommitGroup } from './status-classifier.ts';
import { groupCommits, isChurn } from './loops-detector.ts';
import type { ScanResult } from './types.ts';

function baseScan(over: Partial<ScanResult>): ScanResult {
  return {
    repo: '/repo',
    since: '2026-03-01',
    claude: { files: 0, lines: 0 },
    codex: { filesScanned: 0, repoFiles: 0, lines: 0 },
    planning: { files: 0, keyFiles: 0 },
    memory: { files: 0 },
    git: { branch: 'b', status: '', lastTag: '', branchLog: '', recent: '', commits: [] },
    mentions: new Map(),
    evidenceText: '',
    ledgerSources: [],
    checkboxes: [],
    todos: [],
    ...over,
  };
}

describe('classifyCommitGroup', () => {
  it('single-commit group -> done', () => {
    const [g] = groupCommits([{ date: '2026-05-01', subject: 'feat(x): one' }]);
    expect(classifyCommitGroup(g).status).toBe('done');
  });
  it('one-day many-commit group -> done (not churn)', () => {
    const [g] = groupCommits([
      { date: '2026-05-01', subject: 'feat(y): a' },
      { date: '2026-05-01', subject: 'fix(y): b' },
      { date: '2026-05-01', subject: 'fix(y): c' },
    ]);
    expect(isChurn(g)).toBe(false);
    expect(classifyCommitGroup(g).status).toBe('done');
  });
  it('multi-day re-fix group -> loops', () => {
    const [g] = groupCommits([
      { date: '2026-05-01', subject: 'fix(z): a' },
      { date: '2026-05-02', subject: 'fix(z): b' },
      { date: '2026-05-03', subject: 'fix(z): c' },
    ]);
    expect(classifyCommitGroup(g).status).toBe('loops');
    expect(classifyCommitGroup(g).secondary).toContain('done');
  });
});

describe('buildItems status coverage', () => {
  it('done from checked box + git', () => {
    const items = buildItems(
      baseScan({
        git: { branch: 'b', status: '', lastTag: '', branchLog: '', recent: '', commits: [{ date: '2026-05-01', subject: 'feat(a): x' }] },
        checkboxes: [{ checked: true, text: 'finished thing', file: 'f' }],
      }),
    );
    expect(items.some((i) => i.status === 'done')).toBe(true);
  });
  it('not-started from unchecked box and pending todo', () => {
    const items = buildItems(
      baseScan({
        checkboxes: [{ checked: false, text: 'pending thing', file: 'f' }],
        todos: [{ title: 'todo thing', file: 't.md' }],
      }),
    );
    const ns = items.filter((i) => i.status === 'not-started');
    expect(ns.length).toBeGreaterThanOrEqual(2);
  });
  it('loops from churned git group', () => {
    const items = buildItems(
      baseScan({
        git: {
          branch: 'b', status: '', lastTag: '', branchLog: '', recent: '',
          commits: [
            { date: '2026-05-01', subject: 'fix(slides): a' },
            { date: '2026-05-02', subject: 'fix(slides): b' },
            { date: '2026-05-03', subject: 'feat(slides): c' },
          ],
        },
      }),
    );
    expect(items.some((i) => i.status === 'loops')).toBe(true);
  });
  it('needs-research from AI/RAG + dark mode evidence', () => {
    const items = buildItems(baseScan({ evidenceText: 'Phase 54 AI/RAG seeds. dark mode research.' }));
    expect(items.filter((i) => i.status === 'needs-research').length).toBeGreaterThanOrEqual(2);
  });
  it('ideas-unfiled from Telegram + director evidence', () => {
    const items = buildItems(baseScan({ evidenceText: 'Telegram Phase 55. director workflow idea.' }));
    expect(items.filter((i) => i.status === 'ideas-unfiled').length).toBeGreaterThanOrEqual(2);
  });
  it('blocked from prod H-1 evidence (not done)', () => {
    const items = buildItems(baseScan({ evidenceText: 'H-1 prod deploy block on Keycloak SAML' }));
    expect(items.some((i) => i.status === 'blocked')).toBe(true);
  });
  it('in-progress from open PR and dirty tree', () => {
    const items = buildItems(
      baseScan({
        evidenceText: 'PR #7 open in_review',
        git: { branch: 'b', status: '## b\n?? new.ts\n M old.ts', lastTag: '', branchLog: '', recent: '', commits: [{ date: '2026-05-01', subject: 'feat(a): x' }] },
      }),
    );
    expect(items.filter((i) => i.status === 'in-progress').length).toBeGreaterThanOrEqual(2);
  });
});
