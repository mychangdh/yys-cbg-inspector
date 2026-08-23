import type { RelicView } from "../../types";
import type { CalculatorFilters } from "./types";
import type { FastDimension, FastRelic, FastVector } from "./fastTypes";
import { emptyVector, sumVectors } from "./fastVector";
import { FAST_DIMENSIONS } from "./fastTypes";

export function genericSetRequirementsSatisfied(
  relics: readonly RelicView[],
  filters: CalculatorFilters,
): boolean {
  const counts = new Map<string, number>();
  relics.forEach((relic) => {
    const name = relic.suit?.name;
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  });
  if (
    filters.requiredFourPiece &&
    (counts.get(filters.requiredFourPiece) || 0) < 4
  )
    return false;
  for (const name of filters.requiredTwoPieceNames || [])
    if ((counts.get(name) || 0) < 2) return false;
  for (const attribute of filters.requiredTwoPieceAttributes || []) {
    const active = [...counts.entries()].some(
      ([name, count]) =>
        name !== filters.requiredFourPiece &&
        count >= 2 &&
        filters.suitTwoPieceAttributes?.get(name) === attribute,
    );
    if (!active) return false;
  }
  return [...counts.values()].filter((count) => count >= 4).length <= 1;
}

export function genericRequirementsCanStillBeMet(
  counts: ReadonlyMap<string, number>,
  filters: CalculatorFilters,
  remaining: readonly FastRelic[][],
  remainingSuitCounts?: ReadonlyMap<string, number>,
): boolean {
  const possibleCount = (name: string) =>
    (counts.get(name) || 0) +
    (remainingSuitCounts
      ? remainingSuitCounts.get(name) || 0
      : remaining.reduce(
          (total, candidates) =>
            total + Number(candidates.some((relic) => relic.suit === name)),
          0,
        ));
  if (filters.requiredFourPiece && possibleCount(filters.requiredFourPiece) < 4)
    return false;
  for (const name of filters.requiredTwoPieceNames || [])
    if (possibleCount(name) < 2) return false;
  for (const attribute of filters.requiredTwoPieceAttributes || []) {
    const possible = new Set<string>();
    counts.forEach((_count, name) => {
      if (
        name !== filters.requiredFourPiece &&
        filters.suitTwoPieceAttributes?.get(name) === attribute
      )
        possible.add(name);
    });
    if (remainingSuitCounts)
      remainingSuitCounts.forEach((_count, name) => {
        if (
          name !== filters.requiredFourPiece &&
          filters.suitTwoPieceAttributes?.get(name) === attribute
        )
          possible.add(name);
      });
    else
      remaining.forEach((candidates) =>
        candidates.forEach((relic) => {
          if (
            relic.suit !== filters.requiredFourPiece &&
            filters.suitTwoPieceAttributes?.get(relic.suit) === attribute
          )
            possible.add(relic.suit);
        }),
      );
    if (
      ![...possible].some(
        (name) => (counts.get(name) || 0) >= 2 || possibleCount(name) >= 2,
      )
    )
      return false;
  }
  return [...counts.values()].filter((count) => count >= 4).length <= 1;
}

export function possibleBonusUpperVector(
  twoPieceBySuit: ReadonlyMap<string, FastVector>,
  counts: ReadonlyMap<string, number>,
  activatedBonusSuits: ReadonlySet<string>,
  remaining: readonly FastRelic[][],
  remainingSuitCounts?: ReadonlyMap<string, number>,
): FastVector {
  const upper = emptyVector();
  const possibleBonusCount = Math.max(0, 3 - activatedBonusSuits.size);
  if (!possibleBonusCount) return upper;
  const possibleBonuses: FastVector[] = [];
  twoPieceBySuit.forEach((bonus, suit) => {
    if (activatedBonusSuits.has(suit)) return;
    const possibleCount =
      (counts.get(suit) || 0) +
      (remainingSuitCounts
        ? remainingSuitCounts.get(suit) || 0
        : remaining.reduce(
            (total, candidates) =>
              total + Number(candidates.some((relic) => relic.suit === suit)),
            0,
          ));
    if (possibleCount >= 2) possibleBonuses.push(bonus);
  });
  FAST_DIMENSIONS.forEach((dimension) => {
    const values = possibleBonuses
      .map((bonus) => bonus[dimension])
      .sort((left, right) => right - left);
    for (
      let index = 0;
      index < Math.min(possibleBonusCount, values.length);
      index += 1
    )
      upper[dimension] += values[index];
  });
  return upper;
}

export function genericUpperVector(
  current: FastVector,
  remainingMaximum: FastVector,
  twoPieceBySuit: ReadonlyMap<string, FastVector>,
  counts: ReadonlyMap<string, number>,
  activatedBonusSuits: ReadonlySet<string>,
  remaining: readonly FastRelic[][],
  remainingSuitCounts?: ReadonlyMap<string, number>,
): FastVector {
  return sumVectors(
    sumVectors(current, remainingMaximum),
    possibleBonusUpperVector(
      twoPieceBySuit,
      counts,
      activatedBonusSuits,
      remaining,
      remainingSuitCounts,
    ),
  );
}
