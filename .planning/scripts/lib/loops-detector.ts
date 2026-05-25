/**
 * loops-detector — groups branch commits into workstreams and flags churn.
 *
 * A LOOP here is a workstream that was re-touched repeatedly: the same scope
 * committed ≥3 times across ≥2 distinct dates. Git is the clean signal for this
 * (raw transcript frequency is dominated by context-injection echo and was
 * rejected as a loop driver). Canonical example: the `stage-chip` aria-disabled
 * re-fix landed three times in one workstream.
 */

export interface CommitGroup {
  key: string;
  title: string;
  commits: Array<{ date: string; subject: string }>;
  dates: Set<string>;
  firstDate: string;
  lastDate: string;
}

const CHURN_MIN_COMMITS = 3;
const CHURN_MIN_DATES = 2;

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'add',
  'fix',
  'use',
  'with',
  'from',
  'into',
  'update',
  'apply',
]);

function topicKey(subject: string): string {
  const scoped = subject.match(/^[a-z]+\(([^)]+)\):/i);
  if (scoped) return scoped[1].toLowerCase();
  const bare = subject.match(/^([a-z]+):/i);
  const rest = bare ? subject.slice(bare[0].length) : subject;
  const words = rest
    .toLowerCase()
    .replace(/[^a-zа-я0-9\s-]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return words.slice(0, 2).join('-') || 'misc';
}

export function groupCommits(
  commits: ReadonlyArray<{ date: string; subject: string }>,
): CommitGroup[] {
  const map = new Map<string, CommitGroup>();
  for (const c of commits) {
    const key = topicKey(c.subject);
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        title: key,
        commits: [],
        dates: new Set(),
        firstDate: c.date,
        lastDate: c.date,
      };
      map.set(key, group);
    }
    group.commits.push(c);
    group.dates.add(c.date);
    if (c.date < group.firstDate) group.firstDate = c.date;
    if (c.date > group.lastDate) group.lastDate = c.date;
  }
  // Title = scope + representative (newest) subject, trimmed of the type prefix.
  for (const group of map.values()) {
    const newest = group.commits[0]?.subject ?? group.key;
    const stripped = newest.replace(/^[a-z]+(\([^)]*\))?:\s*/i, '');
    group.title = `${group.key}: ${stripped}`.slice(0, 80);
  }
  return [...map.values()].sort((a, b) => b.commits.length - a.commits.length);
}

export function isChurn(group: CommitGroup): boolean {
  return (
    group.commits.length >= CHURN_MIN_COMMITS &&
    group.dates.size >= CHURN_MIN_DATES
  );
}
