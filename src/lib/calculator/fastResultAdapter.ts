import type { RelicView } from "@/types";
import type {
  CalculatorFilters,
  CalculatorMetric,
  CalculatorResult,
  CalculatedPanel,
  HeroBaseStats,
} from "./types";
import type { FastFixedSuitSearchResult } from "../fastRelicCalculator";

type PanelCalculator = (input: {
  baseStats: HeroBaseStats;
  relics: readonly RelicView[];
  suitTwoPieceAttributes?: ReadonlyMap<string, string>;
}) => CalculatedPanel;
type MetricCalculator = (
  panel: CalculatedPanel,
  metric: CalculatorMetric,
) => number;
type ConstraintChecker = (
  panel: CalculatedPanel,
  constraints: CalculatorFilters["panelConstraints"],
) => boolean;

/** 将极速搜索返回的紧凑结果转换成页面统一的计算结果。 */
export function fastSearchResultToCalculatorResult(
  compactResult: FastFixedSuitSearchResult,
  base: HeroBaseStats,
  metric: CalculatorMetric,
  filters: CalculatorFilters,
  calculatePanel: PanelCalculator,
  calculateMetric: MetricCalculator,
  satisfiesConstraints: ConstraintChecker,
): CalculatorResult | undefined {
  const panel = calculatePanel({
    baseStats: base,
    relics: compactResult.relics,
    suitTwoPieceAttributes: filters.suitTwoPieceAttributes,
  });
  if (!satisfiesConstraints(panel, filters.panelConstraints)) return undefined;

  const suitCounts = new Map<string, number>();
  compactResult.relics.forEach((relic) => {
    const name = relic.suit?.name;
    if (name) suitCounts.set(name, (suitCounts.get(name) || 0) + 1);
  });

  return {
    score: calculateMetric(panel, metric),
    panel,
    relics: compactResult.relics,
    criticalRateOverflow: Math.max(0, panel.critRate - 100),
    suits: [...suitCounts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((left, right) => right[1] - left[1])
      .map(([name, count]) => `${name} x ${count}`),
  };
}
