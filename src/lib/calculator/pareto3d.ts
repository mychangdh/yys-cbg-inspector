import type { FastDimension, FastVector } from "./fastTypes";
import { lowerBound, PARETO_EPSILON } from "./paretoPrimitives";

/**
 * 精确三维 Pareto 过滤。第一维排序后，Fenwick 树维护前面分组在第三维的最大值。
 * 相同第一、第二维的候选按分组处理，保留原搜索的稳定行为。
 */
export function paretoFrontier3D<T extends FastVector>(
  pairs: T[],
  dimensions: readonly [FastDimension, FastDimension, FastDimension],
): T[] {
  if (pairs.length < 2) return pairs;
  const [primary, secondary, tertiary] = dimensions;
  const secondaryValues = [
    ...new Set(pairs.map((pair) => pair[secondary])),
  ].sort((left, right) => left - right);
  const secondaryCount = secondaryValues.length;
  const secondaryRank = (value: number) =>
    secondaryCount - lowerBound(secondaryValues, value);
  const tree = new Float64Array(secondaryCount + 1).fill(
    Number.NEGATIVE_INFINITY,
  );
  const query = (rank: number) => {
    let best = Number.NEGATIVE_INFINITY;
    for (let index = rank; index > 0; index -= index & -index)
      best = Math.max(best, tree[index]);
    return best;
  };
  const update = (rank: number, value: number) => {
    for (let index = rank; index <= secondaryCount; index += index & -index) {
      if (value > tree[index]) tree[index] = value;
    }
  };
  const ordered = pairs
    .map((pair, index) => ({ pair, index }))
    .sort(
      (left, right) =>
        right.pair[primary] - left.pair[primary] ||
        right.pair[secondary] - left.pair[secondary] ||
        right.pair[tertiary] - left.pair[tertiary] ||
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

    let sameGroupMaximum = Number.NEGATIVE_INFINITY;
    let hasHigherSecondary = false;
    let groupCursor = cursor;
    while (groupCursor < primaryEnd) {
      const secondaryValue = ordered[groupCursor].pair[secondary];
      let secondaryEnd = groupCursor + 1;
      while (
        secondaryEnd < primaryEnd &&
        Math.abs(ordered[secondaryEnd].pair[secondary] - secondaryValue) <=
          PARETO_EPSILON
      )
        secondaryEnd += 1;
      for (let index = groupCursor; index < secondaryEnd; index += 1) {
        const candidate = ordered[index].pair;
        const globallyDominated =
          query(secondaryRank(candidate[secondary])) >=
          candidate[tertiary] - PARETO_EPSILON;
        const sameGroupDominated =
          sameGroupMaximum > candidate[tertiary] + PARETO_EPSILON ||
          (sameGroupMaximum >= candidate[tertiary] - PARETO_EPSILON &&
            hasHigherSecondary);
        if (!globallyDominated && !sameGroupDominated) frontier.push(candidate);
      }
      for (let index = groupCursor; index < secondaryEnd; index += 1) {
        sameGroupMaximum = Math.max(
          sameGroupMaximum,
          ordered[index].pair[tertiary],
        );
      }
      hasHigherSecondary = true;
      groupCursor = secondaryEnd;
    }
    for (let index = cursor; index < primaryEnd; index += 1) {
      update(
        secondaryRank(ordered[index].pair[secondary]),
        ordered[index].pair[tertiary],
      );
    }
    cursor = primaryEnd;
  }
  return frontier;
}
