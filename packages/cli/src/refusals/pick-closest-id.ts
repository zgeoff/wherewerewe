const maxDistance = 3;

// The candidate with the smallest edit distance to what was typed, when that distance is at most
// 3. The earliest candidate wins a tie.
export function pickClosestID(typed: string, candidates: readonly string[]): string | null {
  let best: string | null = null;
  let bestDistance = maxDistance + 1;

  for (const candidate of candidates) {
    const distance = measureDistance(typed, candidate);

    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}

function measureDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_unused, index) => index);

  for (const [leftIndex, leftChar] of Array.from(left, (character) => character).entries()) {
    const row = [leftIndex + 1];

    for (const [rightIndex, rightChar] of Array.from(right, (character) => character).entries()) {
      row.push(
        Math.min(
          (previous[rightIndex + 1] ?? 0) + 1,
          (row[rightIndex] ?? 0) + 1,
          (previous[rightIndex] ?? 0) + (leftChar === rightChar ? 0 : 1),
        ),
      );
    }

    previous = row;
  }

  return previous[right.length] ?? 0;
}
