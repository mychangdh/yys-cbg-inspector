import type { FastDimension, FastVector } from "./fastTypes";
import { lowerBound, upperBound, PARETO_EPSILON } from "./paretoPrimitives";
import { paretoFrontier3D } from "./pareto3d";

/**
 * 精确四维 Pareto 过滤。主维度分组内不写入 Fenwick 树，
 * 因此只会被严格更高主维的候选支配；处理完分组后才发布当前组。
 */
export function paretoFrontier4D<T extends FastVector>(
  pairs: T[],
  dimensions: readonly [
    FastDimension,
    FastDimension,
    FastDimension,
    FastDimension,
  ],
): T[] {
  if (pairs.length < 2) return pairs;
  const [primary, secondary, tertiary, value] = dimensions;
  const secondaryValues = [
    ...new Set(pairs.map((pair) => pair[secondary])),
  ].sort((left, right) => left - right);
  const tertiaryValues = [...new Set(pairs.map((pair) => pair[tertiary]))].sort(
    (left, right) => left - right,
  );
  const secondaryCount = secondaryValues.length;
  const innerCoordinates: number[][] = Array.from(
    { length: secondaryCount + 1 },
    () => [],
  );
  const ranks = pairs.map((pair) => {
    const secondaryRank = lowerBound(secondaryValues, pair[secondary]) + 1;
    const secondaryReverse = secondaryCount - secondaryRank + 1;
    const tertiaryReverse =
      tertiaryValues.length - lowerBound(tertiaryValues, pair[tertiary]);
    for (
      let outer = secondaryReverse;
      outer <= secondaryCount;
      outer += outer & -outer
    )
      innerCoordinates[outer].push(tertiaryReverse);
    return { secondaryReverse, tertiaryReverse };
  });
  const innerTrees = innerCoordinates.map((coordinates) => {
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
  const update = (
    secondaryReverse: number,
    tertiaryReverse: number,
    candidateValue: number,
  ) => {
    for (
      let outer = secondaryReverse;
      outer <= secondaryCount;
      outer += outer & -outer
    ) {
      const inner = innerTrees[outer];
      let index = lowerBound(inner.coordinates, tertiaryReverse) + 1;
      while (index < inner.values.length) {
        if (candidateValue > inner.values[index])
          inner.values[index] = candidateValue;
        index += index & -index;
      }
    }
  };
  const query = (secondaryReverse: number, tertiaryReverse: number) => {
    let result = Number.NEGATIVE_INFINITY;
    for (let outer = secondaryReverse; outer > 0; outer -= outer & -outer) {
      const inner = innerTrees[outer];
      let index = upperBound(inner.coordinates, tertiaryReverse);
      while (index > 0) {
        result = Math.max(result, inner.values[index]);
        index -= index & -index;
      }
    }
    return result;
  };
  const ordered = pairs
    .map((pair, index) => ({ pair, index }))
    .sort(
      (left, right) =>
        right.pair[primary] - left.pair[primary] ||
        right.pair[secondary] - left.pair[secondary] ||
        right.pair[tertiary] - left.pair[tertiary] ||
        right.pair[value] - left.pair[value] ||
        left.index - right.index,
    );
  const frontier: T[] = [];
  let cursor = 0;
  while (cursor < ordered.length) {
    const primaryValue = ordered[cursor].pair[primary];
    let primaryEnd = cursor + 1;
    while (
      primaryEnd < ordered.length &&
      Math.abs(ordered[primaryEnd].pair[primary] - primaryValue) <=
        PARETO_EPSILON
    )
      primaryEnd += 1;
    const group = ordered.slice(cursor, primaryEnd);
    const notGloballyDominated = group.filter(({ pair, index }) => {
      const rank = ranks[index];
      return (
        query(rank.secondaryReverse, rank.tertiaryReverse) <
        pair[value] - PARETO_EPSILON
      );
    });
    if (notGloballyDominated.length)
      frontier.push(
        ...paretoFrontier3D(
          notGloballyDominated.map(({ pair }) => pair),
          [secondary, tertiary, value],
        ),
      );
    group.forEach(({ pair, index }) => {
      const rank = ranks[index];
      update(rank.secondaryReverse, rank.tertiaryReverse, pair[value]);
    });
    cursor = primaryEnd;
  }
  return frontier;
}
