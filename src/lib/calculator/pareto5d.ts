import type { FastDimension, FastVector } from "./fastTypes";
import { PARETO_EPSILON } from "./paretoPrimitives";

type FourDimensionIndex<T extends FastVector> = {
  query: (candidate: T) => number;
};

/** 五维前沿按第五维分块，前缀块通过四维索引判断，块内保留精确支配结果。 */
export function paretoFrontier5D<T extends FastVector>(
  pairs: T[],
  dimensions: readonly [
    FastDimension,
    FastDimension,
    FastDimension,
    FastDimension,
    FastDimension,
  ],
  buildFourDimensionIndex: <U extends FastVector>(
    items: readonly U[],
    dimensions: readonly [
      FastDimension,
      FastDimension,
      FastDimension,
      FastDimension,
    ],
  ) => FourDimensionIndex<U>,
  paretoFrontier4D: <U extends FastVector>(
    items: U[],
    dimensions: readonly [
      FastDimension,
      FastDimension,
      FastDimension,
      FastDimension,
    ],
  ) => U[],
): T[] {
  if (pairs.length < 2) return pairs;
  const [primary, second, third, fourth, fifth] = dimensions;
  const remainingDimensions = [second, third, fourth, fifth] as const;
  const ordered = pairs
    .map((pair, index) => ({ pair, index }))
    .sort(
      (left, right) =>
        right.pair[primary] - left.pair[primary] ||
        right.pair[second] - left.pair[second] ||
        right.pair[third] - left.pair[third] ||
        right.pair[fourth] - left.pair[fourth] ||
        right.pair[fifth] - left.pair[fifth] ||
        left.index - right.index,
    );
  const blockSize = 4096;
  const frontier: T[] = [];
  let prefixFrontier: T[] = [];
  let cursor = 0;
  while (cursor < ordered.length) {
    const blockStart = cursor;
    let blockEnd = cursor;
    while (blockEnd < ordered.length) {
      const groupValue = ordered[blockEnd].pair[fifth];
      let groupEnd = blockEnd + 1;
      while (
        groupEnd < ordered.length &&
        Math.abs(ordered[groupEnd].pair[fifth] - groupValue) <= PARETO_EPSILON
      )
        groupEnd += 1;
      blockEnd = groupEnd;
      if (blockEnd - blockStart >= blockSize) break;
    }
    const block = ordered.slice(blockStart, blockEnd).map(({ pair }) => pair);
    const prefixIndex = buildFourDimensionIndex(
      prefixFrontier,
      remainingDimensions,
    );
    const blockSurvivors: T[] = [];
    block.forEach((candidate) => {
      if (prefixIndex.query(candidate) >= candidate[fifth] - PARETO_EPSILON)
        return;
      const dominatedInBlock = blockSurvivors.some((existing) => {
        if (
          existing[second] < candidate[second] - PARETO_EPSILON ||
          existing[third] < candidate[third] - PARETO_EPSILON ||
          existing[fourth] < candidate[fourth] - PARETO_EPSILON ||
          existing[fifth] < candidate[fifth] - PARETO_EPSILON
        )
          return false;
        return (
          existing[second] > candidate[second] + PARETO_EPSILON ||
          existing[third] > candidate[third] + PARETO_EPSILON ||
          existing[fourth] > candidate[fourth] + PARETO_EPSILON ||
          existing[fifth] > candidate[fifth] + PARETO_EPSILON ||
          existing[primary] > candidate[primary] + PARETO_EPSILON
        );
      });
      if (!dominatedInBlock) blockSurvivors.push(candidate);
    });
    frontier.push(...blockSurvivors);
    prefixFrontier = paretoFrontier4D(
      [...prefixFrontier, ...blockSurvivors],
      remainingDimensions,
    );
    cursor = blockEnd;
  }
  return frontier;
}
