import type { CalculatorMetric, HeroBaseStats } from "./types";
import type { FastDimension, FastRelic, FastVector } from "./fastTypes";
import { emptyVector, sumVectors } from "./fastVector";

export type FastPanel = {
  attack: number;
  health: number;
  defense: number;
  speed: number;
  critRate: number;
  critDamage: number;
  effectHit: number;
  effectResistance: number;
};

export function buildMetricSuffixFrontiers(
  options: readonly FastRelic[][],
  metric: CalculatorMetric,
  metricDimensions: (metric: CalculatorMetric) => FastDimension[],
  paretoFrontier: <T extends FastVector>(
    values: T[],
    dimensions: readonly FastDimension[],
  ) => T[],
): { dimensions: FastDimension[]; suffixes: FastVector[][] } {
  const dimensions = metricDimensions(metric);
  const suffixes: FastVector[][] = Array.from(
    { length: options.length + 1 },
    () => [emptyVector()],
  );
  for (let position = options.length - 1; position >= 0; position -= 1) {
    const positionFrontier = paretoFrontier([...options[position]], dimensions);
    const combinations: FastVector[] = [];
    positionFrontier.forEach((left) =>
      suffixes[position + 1].forEach((right) =>
        combinations.push(sumVectors(left, right)),
      ),
    );
    suffixes[position] = paretoFrontier(combinations, dimensions);
  }
  return { dimensions, suffixes };
}

export function calculateMetricUpperBound(
  baseStats: HeroBaseStats,
  current: FastVector,
  suffix: readonly FastVector[],
  metric: CalculatorMetric,
  bonusUpper: FastVector,
  panelForVector: (base: HeroBaseStats, vector: FastVector) => FastPanel,
  metricValue: (panel: FastPanel, metric: CalculatorMetric) => number,
): number {
  let best = Number.NEGATIVE_INFINITY;
  suffix.forEach((future) => {
    const vector = sumVectors(sumVectors(current, future), bonusUpper);
    best = Math.max(
      best,
      metricValue(panelForVector(baseStats, vector), metric),
    );
  });
  return best;
}
