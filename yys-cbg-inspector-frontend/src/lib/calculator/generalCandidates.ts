import type { RelicView } from "@/types";
import type { CalculatorFilters } from "./types";

type CandidateScore = (relic: RelicView) => number;

/**
 * 准备通用搜索的基础候选池。
 * 这里集中处理用户筛选条件，组合搜索只接收已经按号位分组的候选。
 */
export function prepareEligibleRelics(
  relicsByPosition: Record<string, RelicView[]>,
  filters: CalculatorFilters,
  positions: readonly number[],
  score: CandidateScore,
): RelicView[][] {
  return positions.map((position) => {
    const mainAttributes = filters.mainAttributes[position as 2 | 4 | 6];
    return (relicsByPosition[String(position)] || [])
      .filter((relic) => (relic.quality || 0) >= filters.quality)
      .filter((relic) => (relic.level || 0) >= filters.level)
      .filter((relic) => {
        const selected = filters.selectedRelicIds?.[position];
        return (
          !selected || selected.size === 0 || selected.has(String(relic.id))
        );
      })
      .filter(
        (relic) => !filters.suitName || relic.suit?.name === filters.suitName,
      )
      .filter(
        (relic) =>
          !mainAttributes?.length ||
          mainAttributes.includes(relic.mainAttribute?.label || ""),
      )
      .sort((left, right) => score(right) - score(left));
  });
}
