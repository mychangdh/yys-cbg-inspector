import type { RelicView } from "@/types";
import type {
  FastDimension,
  FastRelic,
  FastVector,
  PairCandidate,
  QuadCandidate,
} from "./fastTypes";
import { sumThreeFastVectors, sumFastVectors } from "./fastVector";
import { paretoFrontierWithExactDimensions } from "./fastPreparation";

export function fastPairBonus(
  left: FastRelic,
  right: FastRelic,
  fixedSuit: string,
  twoPieceBySuit: ReadonlyMap<string, FastVector>,
): FastVector | undefined {
  if (
    !left.suit ||
    left.suit !== right.suit ||
    left.suit === fixedSuit ||
    right.hasOnePieceBonus
  )
    return undefined;
  return twoPieceBySuit.get(left.suit);
}

/** 两件套收益必须来自真实同套的两件御魂，不能把不同套装的属性拼接。 */
export function buildFastPairCandidates(
  left: readonly FastRelic[],
  right: readonly FastRelic[],
  fixedSuit: string,
  twoPieceBySuit: ReadonlyMap<string, FastVector>,
  forcedBonus?: FastVector,
): PairCandidate[] {
  const pairs: PairCandidate[] = [];
  left.forEach((leftRelic) =>
    right.forEach((rightRelic) => {
      const actualBonus = fastPairBonus(
        leftRelic,
        rightRelic,
        fixedSuit,
        twoPieceBySuit,
      );
      const bonus = forcedBonus
        ? rightRelic.hasOnePieceBonus
          ? undefined
          : forcedBonus
        : actualBonus;
      if (!forcedBonus && actualBonus) return;
      pairs.push({
        left: leftRelic,
        right: rightRelic,
        ...sumThreeFastVectors(leftRelic, rightRelic, bonus),
      });
    }),
  );
  return pairs;
}

export function buildFastPairFrontier(
  left: readonly FastRelic[],
  right: readonly FastRelic[],
  fixedSuit: string,
  twoPieceBySuit: ReadonlyMap<string, FastVector>,
  dimensions: readonly FastDimension[],
  paretoFrontier: <T extends FastVector>(
    items: T[],
    dimensions: readonly FastDimension[],
  ) => T[],
  forcedBonus?: FastVector,
  exactDimensions: readonly FastDimension[] = [],
): PairCandidate[] {
  return paretoFrontierWithExactDimensions(
    buildFastPairCandidates(
      left,
      right,
      fixedSuit,
      twoPieceBySuit,
      forcedBonus,
    ),
    dimensions.filter((dimension) => !exactDimensions.includes(dimension)),
    exactDimensions,
    paretoFrontier,
  );
}

export function buildFastQuadFrontier(
  first: readonly PairCandidate[],
  second: readonly PairCandidate[],
  dimensions: readonly FastDimension[],
  paretoFrontier: <T extends FastVector>(
    items: T[],
    dimensions: readonly FastDimension[],
  ) => T[],
  exactDimensions: readonly FastDimension[] = [],
): QuadCandidate[] {
  const quads: QuadCandidate[] = [];
  first.forEach((left) =>
    second.forEach((right) =>
      quads.push({
        first: left,
        second: right,
        ...sumFastVectors(left, right),
      }),
    ),
  );
  return paretoFrontierWithExactDimensions(
    quads,
    dimensions.filter((dimension) => !exactDimensions.includes(dimension)),
    exactDimensions,
    paretoFrontier,
  );
}

export function countFastSuits(
  relics: readonly RelicView[],
): Map<string, number> {
  const counts = new Map<string, number>();
  relics.forEach((relic) => {
    const name = relic.suit?.name;
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  });
  return counts;
}
