/**
 * status-classifier — turns scan evidence into classified AuditItems.
 *
 * Priority of evidence:
 *   git commit groups  -> DONE (default) / LOOPS (churn)
 *   NEXT-ACTIONS boxes -> DONE ([x]) / NOT-STARTED ([ ])
 *   todos/pending      -> NOT-STARTED
 *   evidence-gated rules -> BLOCKED / NEEDS-RESEARCH / IDEAS-UNFILED
 *
 * Transcript mention aggregates are used only to enrich first/last timestamps
 * and distinct-session counts — never to drive the bucket.
 */

import type { AuditItem, MentionAggregate, ScanResult, Status } from './types.ts';
import { groupCommits, isChurn, type CommitGroup } from './loops-detector.ts';

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function clip(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
}

const ID_TOKEN_RE =
  /\b(PRJ-\d+|UFB-\d+|LOCK-\d+|PHASE \d+|H-[1-9]|T-[A-Z]+\d*|F\d{1,3}|v8\.\d|NODE ?2[0-9])\b/i;

function matchAggregate(
  text: string,
  mentions: Map<string, MentionAggregate>,
): MentionAggregate | null {
  const m = text.toUpperCase().match(ID_TOKEN_RE);
  if (!m) return null;
  return mentions.get(m[0].replace(/\s+/g, ' ')) ?? null;
}

/** Pure classifier for a git commit group (testable). */
export function classifyCommitGroup(group: CommitGroup): {
  status: Status;
  secondary: Status[];
  recommendation: string;
} {
  if (isChurn(group)) {
    return {
      status: 'loops',
      secondary: ['done'],
      recommendation: clip(
        `churn: ${group.commits.length} commits over ${group.dates.size} days — consolidate + add regression test to stop re-fixes`,
      ),
    };
  }
  return {
    status: 'done',
    secondary: [],
    recommendation: `(closed — ${group.commits.length} commit${group.commits.length > 1 ? 's' : ''}, last ${group.lastDate})`,
  };
}

/** Evidence-gated rules for deferred / blocked / research topics. */
interface LedgerRule {
  id: string;
  re: RegExp;
  title: string;
  status: Status;
  recommendation: string;
  /** if this regex hits the evidence, the item is already DONE -> skip */
  doneIf?: RegExp;
}

const LEDGER_RULES: readonly LedgerRule[] = [
  {
    id: 'phase-54-ai-rag',
    re: /Phase 54|AI\/RAG|\bRAG\b/i,
    title: 'Phase 54 — AI/RAG assistant',
    status: 'needs-research',
    recommendation: 'Seeds/mock only — needs a real AI-integration phase before activation (see TODO).',
  },
  {
    id: 'phase-55-telegram',
    re: /Phase 55|Telegram/i,
    title: 'Phase 55 — Telegram notifications',
    status: 'ideas-unfiled',
    recommendation: 'Activation deferred, seeds-only path — file a phase when notifications are prioritised.',
  },
  {
    id: 'dark-mode-theme',
    re: /dark mode|тёмн|theme switch|theme toggle|rebrand|background change/i,
    title: 'Dark mode / theme switching',
    status: 'needs-research',
    recommendation: 'Research-only per CLAUDE.md — needs explicit user sign-off before CSS token work.',
  },
  {
    id: 'i18n-language',
    re: /\bi18n\b|language switch|LanguageComingSoon|локализац/i,
    title: 'Language / i18n switcher',
    status: 'not-started',
    recommendation: 'Deferred behind ComingSoonBadge — no real i18n phase exists yet.',
  },
  {
    id: 'holidays-calendar',
    re: /holidays.*calendar|calendar.*holiday|2026-05-21-holidays-calendar/i,
    title: 'Holidays working-calendar backend',
    status: 'not-started',
    recommendation: 'UI Coming-Soon shipped; calendar/holiday backend integration still pending (todo filed).',
  },
  {
    id: 'director-workflow',
    re: /director workflow|runtime director/i,
    title: 'Director runtime workflow',
    status: 'ideas-unfiled',
    recommendation: 'Frozen — do not build unless direction is explicitly reopened (viewer read-only path used).',
  },
  {
    id: 'prod-blockers',
    re: /\bH-1\b|\bH-3\b|prod deploy block|Keycloak SAML.*prod|prod.*Keycloak/i,
    title: 'Production deploy blockers (H-1 / H-3)',
    status: 'blocked',
    recommendation: 'Prod path needs Keycloak SAML + dev-auth rejection verified before deploy.',
    doneIf: /H-1.*(done|fixed|resolved|closed)/i,
  },
];

function enrich(
  base: Omit<AuditItem, 'firstMention' | 'lastTouch' | 'distinctSessions' | 'mentions'>,
  agg: MentionAggregate | null,
  fallbackDate?: { first?: string; last?: string; sessions?: number },
): AuditItem {
  return {
    ...base,
    firstMention: agg?.firstTs ?? fallbackDate?.first ?? null,
    lastTouch: agg?.lastTs ?? fallbackDate?.last ?? null,
    distinctSessions: agg ? agg.sessions.size : (fallbackDate?.sessions ?? 0),
    mentions: agg?.count ?? 0,
  };
}

export function buildItems(scan: ScanResult): AuditItem[] {
  const items: AuditItem[] = [];
  const seen = new Set<string>();

  // 1. Git commit groups -> DONE / LOOPS.
  const groups = groupCommits(scan.git.commits);
  for (const group of groups) {
    const { status, secondary, recommendation } = classifyCommitGroup(group);
    const id = 'git-' + slug(group.key);
    if (seen.has(id)) continue;
    seen.add(id);
    // Git groups are scope-keyed; transcript token enrichment is unreliable
    // (a title substring like "F1.5" would borrow F1's mention stats). Use the
    // commit dates as authoritative; mentions reflect commit count.
    items.push({
      id,
      title: group.title,
      status,
      secondary,
      sessionId: `git:${group.key} (${group.commits.length} commits)`,
      recommendation,
      sources: ['git'],
      firstMention: group.firstDate,
      lastTouch: group.lastDate,
      distinctSessions: group.dates.size,
      mentions: group.commits.length,
    });
  }

  // 2. NEXT-ACTIONS checkboxes.
  for (const box of scan.checkboxes) {
    const id = 'box-' + slug(box.text);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const status: Status = box.checked ? 'done' : 'not-started';
    const agg = matchAggregate(box.text, scan.mentions);
    items.push(
      enrich(
        {
          id,
          title: clip(box.text, 80),
          status,
          secondary: [],
          sessionId: box.file,
          recommendation: box.checked
            ? '(closed — checked in NEXT-ACTIONS)'
            : clip(`Pending action: ${box.text}`),
          sources: ['planning'],
        },
        agg,
      ),
    );
  }

  // 3. Pending todos -> NOT-STARTED.
  for (const todo of scan.todos) {
    const id = 'todo-' + slug(todo.title);
    if (seen.has(id)) continue;
    seen.add(id);
    const agg = matchAggregate(todo.title, scan.mentions);
    items.push(
      enrich(
        {
          id,
          title: clip(todo.title, 80),
          status: 'not-started',
          secondary: [],
          sessionId: todo.file,
          recommendation: clip(`Execute filed todo: ${todo.file}`),
          sources: ['planning'],
        },
        agg,
      ),
    );
  }

  // 4. In-progress: open unmerged PR + uncommitted working tree.
  const prNums = [...scan.evidenceText.matchAll(/PR #(\d+)/g)].map((m) => Number(m[1]));
  const prNum = prNums.length ? Math.max(...prNums) : null;
  if (prNum || /in_review|in-review/i.test(scan.evidenceText)) {
    const id = 'wip-open-pr';
    if (!seen.has(id)) {
      seen.add(id);
      const branch = scan.git.branch || 'feature branch';
      items.push(
        enrich(
          {
            id,
            title: prNum ? `PR #${prNum} open — branch not merged to main` : `Branch ${branch} in review`,
            status: 'in-progress',
            secondary: [],
            sessionId: '.planning/STATE.md',
            recommendation: clip(`Land review on ${branch}; merge to main to close ${scan.git.commits.length} branch commits.`),
            sources: ['git', 'planning'],
          },
          null,
          {
            first: scan.git.commits[scan.git.commits.length - 1]?.date,
            last: scan.git.commits[0]?.date,
          },
        ),
      );
    }
  }
  const dirty = scan.git.status
    .split(/\n/)
    .filter((l) => /^[ ?MARCD]{2}\s/.test(l) && !l.startsWith('##'));
  if (dirty.length) {
    const id = 'wip-dirty-tree';
    if (!seen.has(id)) {
      seen.add(id);
      const sample = dirty.slice(0, 3).map((l) => l.trim().split(/\s+/).pop()).join(', ');
      items.push(
        enrich(
          {
            id,
            title: `Uncommitted working tree (${dirty.length} path${dirty.length > 1 ? 's' : ''})`,
            status: 'in-progress',
            secondary: [],
            sessionId: 'git status',
            recommendation: clip(`Commit or revert: ${sample}${dirty.length > 3 ? ', …' : ''}`),
            sources: ['git'],
          },
          null,
        ),
      );
    }
  }

  // 5. Evidence-gated deferred / blocked / research topics.
  for (const rule of LEDGER_RULES) {
    if (!rule.re.test(scan.evidenceText)) continue;
    if (rule.doneIf && rule.doneIf.test(scan.evidenceText)) continue;
    const id = 'rule-' + rule.id;
    if (seen.has(id)) continue;
    seen.add(id);
    const agg = matchAggregate(rule.title, scan.mentions);
    items.push(
      enrich(
        {
          id,
          title: rule.title,
          status: rule.status,
          secondary: [],
          sessionId: 'evidence:.planning + CLAUDE.md',
          recommendation: clip(rule.recommendation),
          sources: ['planning', 'evidence'],
        },
        agg,
      ),
    );
  }

  return items;
}
