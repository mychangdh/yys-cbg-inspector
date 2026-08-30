import { relicsForState, type BeamState } from "./fixedSuitState";
import type { StatBag } from "./relicStats";
import type {
  CalculatedPanel,
  CalculatorMetric,
  CalculatorResult,
  HeroBaseStats,
} from "./types";

/** 将最终状态还原为结果对象；中间搜索继续共享链表前缀以降低内存压力。 */
export function resultFromState(
  state: BeamState,
  base: HeroBaseStats,
  metric: CalculatorMetric,
  panelFor: (base: HeroBaseStats, stats: StatBag) => CalculatedPanel,
  metricValue: (panel: CalculatedPanel, metric: CalculatorMetric) => number,
  criticalRateOverflow: (state: BeamState, base: HeroBaseStats) => number,
): CalculatorResult {
  const panel = panelFor(base, state.stats);
  const relics = relicsForState(state);
  const displaySuitCounts =
    state.firstFreeSuitName === undefined
      ? state.suitCounts
      : relics.reduce<Record<string, number>>((counts, relic) => {
          const name = relic.suit?.name;
          if (name) counts[name] = (counts[name] || 0) + 1;
          return counts;
        }, {});
  return {
    score: metricValue(panel, metric),
    panel,
    relics,
    criticalRateOverflow: criticalRateOverflow(state, base),
    suits: Object.entries(displaySuitCounts)
      .filter(([, count]) => count >= 2)
      .sort((left, right) => right[1] - left[1])
      .map(([name, count]) => `${name}×${count}`),
  };
}
