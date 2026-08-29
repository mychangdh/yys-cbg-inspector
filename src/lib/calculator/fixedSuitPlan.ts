import type { RelicView } from "@/types";
import type { CalculatorFilters } from "./types";
import { canonical } from "./relicStats";
import { parseTwoPieceAttribute } from "./setRules";

export const POSITION_ORDER = [1, 2, 3, 4, 5, 6] as const;

export type FixedSuitLayoutVariant = {
  pattern: boolean[];
  twoPieceName?: string;
};

export type FixedSuitLayoutPlan = {
  variants: FixedSuitLayoutVariant[];
  totalRelics: number;
};

export function fixedSuitPatterns(requiredPieceCount = 4): boolean[][] {
  const patterns: boolean[][] = [];
  for (let mask = 0; mask < 1 << POSITION_ORDER.length; mask += 1) {
    const pattern = POSITION_ORDER.map((_, index) =>
      Boolean(mask & (1 << index)),
    );
    if (pattern.filter(Boolean).length === requiredPieceCount)
      patterns.push(pattern);
  }
  return patterns;
}

export function createFixedSuitLayoutPlan(
  eligibleRelics: RelicView[][],
  filters: CalculatorFilters,
  fixedSuitName: string,
  fixedPieceCount: 2 | 4,
  twoPieceNames: readonly string[] | undefined,
): FixedSuitLayoutPlan {
  const allPatterns = fixedSuitPatterns(fixedPieceCount);
  const patterns = filters.fixedPatternIndexes?.length
    ? filters.fixedPatternIndexes.flatMap((index) =>
        allPatterns[index] ? [allPatterns[index]] : [],
      )
    : allPatterns;
  const twoPieceOptions = twoPieceNames?.length
    ? [...twoPieceNames].sort((left, right) => {
        const leftAttribute = parseTwoPieceAttribute(
          filters.suitTwoPieceAttributes?.get(left),
        );
        const rightAttribute = parseTwoPieceAttribute(
          filters.suitTwoPieceAttributes?.get(right),
        );
        const leftKey = leftAttribute
          ? canonical(leftAttribute.label)
          : "other";
        const rightKey = rightAttribute
          ? canonical(rightAttribute.label)
          : "other";
        const priority = (key: string) =>
          key === "attackPercent" ? 2 : key === "critDamage" ? 1 : 0;
        return (
          priority(rightKey) - priority(leftKey) ||
          Number(rightAttribute?.value || 0) -
            Number(leftAttribute?.value || 0) ||
          left.localeCompare(right)
        );
      })
    : [undefined];
  const canBuildPattern = (
    pattern: readonly boolean[],
    twoPieceName: string | undefined,
  ): boolean =>
    pattern.every((isFourPiece, positionIndex) =>
      eligibleRelics[positionIndex].some((relic) =>
        isFourPiece
          ? relic.suit?.name === fixedSuitName
          : !twoPieceName || relic.suit?.name === twoPieceName,
      ),
    );
  const variants = patterns.flatMap((pattern) =>
    twoPieceOptions.flatMap((twoPieceName) =>
      canBuildPattern(pattern, twoPieceName) ? [{ pattern, twoPieceName }] : [],
    ),
  );
  const matchingCountCache = new Map<string, number>();
  const matchingCount = (
    positionIndex: number,
    isFourPiece: boolean,
    twoPieceName: string | undefined,
  ): number => {
    const key = `${positionIndex}:${isFourPiece ? "four" : twoPieceName || "all"}`;
    const cached = matchingCountCache.get(key);
    if (cached !== undefined) return cached;
    const count = eligibleRelics[positionIndex].reduce((total, relic) => {
      const matches = isFourPiece
        ? relic.suit?.name === fixedSuitName
        : !twoPieceName || relic.suit?.name === twoPieceName;
      return total + Number(matches);
    }, 0);
    matchingCountCache.set(key, count);
    return count;
  };
  return {
    variants,
    totalRelics: variants.reduce(
      (total, { pattern, twoPieceName }) =>
        total +
        pattern.reduce(
          (patternTotal, isFourPiece, positionIndex) =>
            patternTotal +
            matchingCount(positionIndex, isFourPiece, twoPieceName),
          0,
        ),
      0,
    ),
  };
}
