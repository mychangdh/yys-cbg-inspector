import { lowerBound, upperBound } from "./paretoPrimitives";
import type { FastDimension, FastVector } from "./fastTypes";

export type FourDimensionIndex<T extends FastVector> = {
  query: (candidate: T) => number;
};

/**
 * 建立四维前缀 Fenwick 索引。
 * 查询只返回满足前三维不低于候选值的第四维最大值，供五维 Pareto 剪枝使用。
 */
export function buildFourDimensionIndex<T extends FastVector>(
  pairs: readonly T[],
  dimensions: readonly [
    FastDimension,
    FastDimension,
    FastDimension,
    FastDimension,
  ],
): FourDimensionIndex<T> {
  const [primary, secondary, tertiary, value] = dimensions;
  const primaryValues = [...new Set(pairs.map((pair) => pair[primary]))].sort(
    (left, right) => left - right,
  );
  const secondaryValues = [
    ...new Set(pairs.map((pair) => pair[secondary])),
  ].sort((left, right) => left - right);
  const tertiaryValues = [...new Set(pairs.map((pair) => pair[tertiary]))].sort(
    (left, right) => left - right,
  );
  const primaryCount = primaryValues.length;
  const primaryCoordinates: number[][] = Array.from(
    { length: primaryCount + 1 },
    () => [],
  );
  const ranks = pairs.map((pair) => {
    const primaryRank = lowerBound(primaryValues, pair[primary]) + 1;
    const primaryReverse = primaryCount - primaryRank + 1;
    const secondaryRank = lowerBound(secondaryValues, pair[secondary]) + 1;
    const secondaryReverse = secondaryValues.length - secondaryRank + 1;
    const tertiaryReverse =
      tertiaryValues.length - lowerBound(tertiaryValues, pair[tertiary]);
    for (
      let outer = primaryReverse;
      outer <= primaryCount;
      outer += outer & -outer
    ) {
      primaryCoordinates[outer].push(secondaryReverse);
    }
    return { primaryReverse, secondaryReverse, tertiaryReverse };
  });
  const middleTrees = primaryCoordinates.map((coordinates) => {
    const secondaryCoordinates = [...new Set(coordinates)].sort(
      (left, right) => left - right,
    );
    return {
      secondaryCoordinates,
      tertiaryCoordinates: Array.from(
        { length: secondaryCoordinates.length + 1 },
        () => [] as number[],
      ),
      trees: [] as { coordinates: number[]; values: Float64Array }[],
    };
  });
  ranks.forEach((rank) => {
    for (
      let primaryIndex = rank.primaryReverse;
      primaryIndex <= primaryCount;
      primaryIndex += primaryIndex & -primaryIndex
    ) {
      const middle = middleTrees[primaryIndex];
      const secondaryIndex =
        lowerBound(middle.secondaryCoordinates, rank.secondaryReverse) + 1;
      for (
        let index = secondaryIndex;
        index < middle.tertiaryCoordinates.length;
        index += index & -index
      ) {
        middle.tertiaryCoordinates[index].push(rank.tertiaryReverse);
      }
    }
  });
  middleTrees.forEach((middle) => {
    middle.trees = middle.tertiaryCoordinates.map((coordinates) => {
      const unique = [...new Set(coordinates)].sort(
        (left, right) => left - right,
      );
      return {
        coordinates: unique,
        values: new Float64Array(unique.length + 1).fill(
          Number.NEGATIVE_INFINITY,
        ),
      };
    });
  });
  const update = (
    primaryReverse: number,
    secondaryReverse: number,
    tertiaryReverse: number,
    candidateValue: number,
  ) => {
    for (
      let primaryIndex = primaryReverse;
      primaryIndex <= primaryCount;
      primaryIndex += primaryIndex & -primaryIndex
    ) {
      const middle = middleTrees[primaryIndex];
      const secondaryIndex =
        lowerBound(middle.secondaryCoordinates, secondaryReverse) + 1;
      for (
        let index = secondaryIndex;
        index < middle.trees.length;
        index += index & -index
      ) {
        const inner = middle.trees[index];
        let tertiaryIndex = lowerBound(inner.coordinates, tertiaryReverse) + 1;
        while (tertiaryIndex < inner.values.length) {
          if (candidateValue > inner.values[tertiaryIndex]) {
            inner.values[tertiaryIndex] = candidateValue;
          }
          tertiaryIndex += tertiaryIndex & -tertiaryIndex;
        }
      }
    }
  };
  pairs.forEach((_pair, index) => {
    const rank = ranks[index];
    update(
      rank.primaryReverse,
      rank.secondaryReverse,
      rank.tertiaryReverse,
      pairs[index][value],
    );
  });
  return {
    query: (candidate) => {
      if (!pairs.length) return Number.NEGATIVE_INFINITY;
      const primaryRank = lowerBound(primaryValues, candidate[primary]) + 1;
      const primaryReverse = primaryCount - primaryRank + 1;
      const secondaryRank =
        lowerBound(secondaryValues, candidate[secondary]) + 1;
      const secondaryReverse = secondaryValues.length - secondaryRank + 1;
      const tertiaryReverse =
        tertiaryValues.length - lowerBound(tertiaryValues, candidate[tertiary]);
      let result = Number.NEGATIVE_INFINITY;
      for (
        let primaryIndex = primaryReverse;
        primaryIndex > 0;
        primaryIndex -= primaryIndex & -primaryIndex
      ) {
        const middle = middleTrees[primaryIndex];
        let secondaryIndex = upperBound(
          middle.secondaryCoordinates,
          secondaryReverse,
        );
        while (secondaryIndex > 0) {
          const inner = middle.trees[secondaryIndex];
          let tertiaryIndex = upperBound(inner.coordinates, tertiaryReverse);
          while (tertiaryIndex > 0) {
            result = Math.max(result, inner.values[tertiaryIndex]);
            tertiaryIndex -= tertiaryIndex & -tertiaryIndex;
          }
          secondaryIndex -= secondaryIndex & -secondaryIndex;
        }
      }
      return result;
    },
  };
}
