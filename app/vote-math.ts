export type VotePersonLike = {
  picks: string[];
};

export type VoteMetrics = {
  min: number;
  expected: number;
  max: number;
  score: number;
  rank: number;
  isTie: boolean;
};

function roundRankScore(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateVoteResults<TCandidate extends { id: string }>(
  candidates: readonly TCandidate[],
  people: readonly VotePersonLike[],
): Array<TCandidate & VoteMetrics> {
  const completedPeople = people.filter((person) => person.picks.length > 0);
  const candidateOrder = new Map(
    candidates.map((candidate, index) => [candidate.id, index]),
  );

  const calculated = candidates.map((candidate) => {
    const metrics = completedPeople.reduce(
      (current, person) => {
        if (!person.picks.includes(candidate.id)) return current;
        return {
          min: current.min + (person.picks.length === 1 ? 1 : 0),
          expected: current.expected + 1 / person.picks.length,
          max: current.max + 1,
        };
      },
      { min: 0, expected: 0, max: 0 },
    );

    return {
      ...candidate,
      ...metrics,
      score: roundRankScore(
        (metrics.min + metrics.expected + metrics.max) / 3,
      ),
    };
  });

  const sorted = [...calculated].sort(
    (a, b) =>
      b.score - a.score ||
      b.expected - a.expected ||
      b.min - a.min ||
      b.max - a.max ||
      (candidateOrder.get(a.id) ?? 0) - (candidateOrder.get(b.id) ?? 0),
  );

  const ranked = sorted.map((result, resultIndex) => {
    const rank = sorted
      .slice(0, resultIndex + 1)
      .reduce((denseRank, item, itemIndex, items) => {
        const startsNewRank =
          itemIndex === 0 || item.score !== items[itemIndex - 1].score;
        return startsNewRank ? denseRank + 1 : denseRank;
      }, 0);
    return { ...result, rank, isTie: false };
  });

  const rankCounts = new Map<number, number>();
  ranked.forEach((result) => {
    rankCounts.set(result.rank, (rankCounts.get(result.rank) ?? 0) + 1);
  });

  return ranked.map((result) => ({
    ...result,
    isTie: (rankCounts.get(result.rank) ?? 0) > 1,
  }));
}
