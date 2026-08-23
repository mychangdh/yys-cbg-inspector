import type { RelicView } from "../../types";
import {
  calculateRelicPanel,
  calculatePanelMetric,
  satisfiesPanelRange,
} from "./panel";
import type {
  CalculatorFilters,
  CalculatorMetric,
  CalculatorResult,
  HeroBaseStats,
} from "./types";

/** 把搜索内核的真实御魂组合转换成页面统一结果。 */
export function createCalculatorResult(
  relics: RelicView[],
  base: HeroBaseStats,
  metric: CalculatorMetric,
  filters: CalculatorFilters,
): CalculatorResult | undefined {
  const panel = calculateRelicPanel({
    baseStats: base,
    relics,
    suitTwoPieceAttributes: filters.suitTwoPieceAttributes,
  });
  if (!satisfiesPanelRange(panel, filters.panelConstraints)) return undefined;

  const suitCounts = new Map<string, number>();
  relics.forEach((relic) => {
    const name = relic.suit?.name;
    if (name) suitCounts.set(name, (suitCounts.get(name) || 0) + 1);
  });
  return {
    score: calculatePanelMetric(panel, metric),
    panel,
    relics,
    criticalRateOverflow: Math.max(0, panel.critRate - 100),
    suits: [...suitCounts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((left, right) => right[1] - left[1])
      .map(([name, count]) => `${name} x ${count}`),
  };
}
