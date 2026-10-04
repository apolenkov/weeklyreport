type Factor = Readonly<{ id: string; values: readonly string[] }>;
type Choice = readonly [id: string, value: string];
type Pair = readonly [Choice, Choice];

function pairKey(left: Choice, right: Choice): string {
  return JSON.stringify(left[0] < right[0] ? [left, right] : [right, left]);
}

function combinations(left: Factor, right: Factor): readonly Pair[] {
  return left.values.flatMap((a) =>
    right.values.map(
      (b) =>
        [
          [left.id, a],
          [right.id, b],
        ] as const,
    ),
  );
}

function requirements(factors: readonly Factor[]): Map<string, Pair> {
  const remaining = new Map<string, Pair>();
  for (const [index, left] of factors.entries()) {
    for (const right of factors.slice(index + 1)) {
      for (const pair of combinations(left, right)) {
        remaining.set(pairKey(...pair), pair);
      }
    }
  }
  return remaining;
}

function score(
  choice: Choice,
  assigned: ReadonlyMap<string, string>,
  remaining: ReadonlyMap<string, Pair>,
): number {
  let count = 0;
  for (const other of assigned) {
    if (remaining.has(pairKey(choice, other))) count += 1;
  }
  return count;
}

function bestValue(
  factor: Factor,
  assigned: ReadonlyMap<string, string>,
  remaining: ReadonlyMap<string, Pair>,
): string {
  let best = "";
  let bestScore = -1;
  for (const value of factor.values) {
    const candidateScore = score([factor.id, value], assigned, remaining);
    if (candidateScore > bestScore) {
      best = value;
      bestScore = candidateScore;
    }
  }
  return best;
}

function nextRow(
  seed: Pair,
  factors: readonly Factor[],
  remaining: ReadonlyMap<string, Pair>,
): Readonly<Record<string, string>> {
  const assigned = new Map<string, string>(seed);
  for (const factor of factors) {
    if (!assigned.has(factor.id))
      assigned.set(factor.id, bestValue(factor, assigned, remaining));
  }
  return Object.fromEntries(assigned);
}

function removeCovered(
  row: Readonly<Record<string, string>>,
  remaining: Map<string, Pair>,
): void {
  for (const [key, [left, right]] of remaining) {
    if (row[left[0]] === left[1] && row[right[0]] === right[1])
      remaining.delete(key);
  }
}

/** Cover value pairs without constructing the complete Cartesian product. */
export function pairwise(
  factors: readonly Factor[],
): readonly Readonly<Record<string, string>>[] {
  if (new Set(factors.map(({ id }) => id)).size !== factors.length)
    throw new TypeError("Pairwise factors must have unique ids");
  const unique = factors.map(({ id, values }) => ({
    id,
    values: [...new Set(values)],
  }));
  if (unique.some(({ values }) => values.length === 0)) return [];
  const first = unique.at(0);
  if (!first) return [{}];
  if (unique.length === 1)
    return first.values.map((value) => Object.fromEntries([[first.id, value]]));
  const remaining = requirements(unique);
  const rows: Readonly<Record<string, string>>[] = [];
  for (
    let seed = remaining.values().next().value;
    seed;
    seed = remaining.values().next().value
  ) {
    const row = nextRow(seed, unique, remaining);
    rows.push(row);
    removeCovered(row, remaining);
  }
  return rows;
}
