import type { RelicView } from "@/types";
import { POSITION_ORDER } from "./fixedSuitPlan";
import type { CalculatorFilters } from "./types";

/**
 * 估算通用搜索规模。它只用于进度展示和路径选择，不参与结果排序，
 * 因此必须保持保守：无法确定时宁可返回更大的估计值。
 */
export function estimateGeneralSearchWork(
  relicsByPosition: Record<string, RelicView[]>,
  filters: CalculatorFilters,
): number {
  let estimate = 1;
  for (const position of POSITION_ORDER) {
    const allowedMain = filters.mainAttributes[position as 2 | 4 | 6];
    let count = 0;
    for (const relic of relicsByPosition[String(position)] || []) {
      const selected = filters.selectedRelicIds?.[position];
      if ((relic.quality || 0) < filters.quality) continue;
      if ((relic.level || 0) < filters.level) continue;
      if (selected?.size && !selected.has(String(relic.id))) continue;
      if (filters.suitName && relic.suit?.name !== filters.suitName) continue;
      if (
        allowedMain?.length &&
        !allowedMain.includes(relic.mainAttribute?.label || "")
      )
        continue;
      count += 1;
    }
    if (!count) return 0;
    estimate = Math.min(10_000_001, estimate * count);
    if (estimate > 10_000_000) return estimate;
  }
  return estimate;
}

/**
 * 两件套必须覆盖两个不同号位。这个预筛选只排除物理上不可能触发的套装，
 * 不会根据属性强弱删除御魂，所以不会改变普通和极速模式的最优结果。
 */
export function availableTwoPieceSuitNames(
  eligibleRelics: RelicView[][],
  suitNames: readonly string[],
): string[] {
  const requestedNames = new Set(suitNames);
  const positionsBySuit = new Map<string, Set<number>>();

  eligibleRelics.forEach((relics, positionIndex) => {
    relics.forEach((relic) => {
      const suitName = relic.suit?.name;
      if (!suitName || !requestedNames.has(suitName)) return;
      const positions = positionsBySuit.get(suitName) || new Set<number>();
      positions.add(positionIndex);
      positionsBySuit.set(suitName, positions);
    });
  });

  return suitNames.filter(
    (suitName) => (positionsBySuit.get(suitName)?.size || 0) >= 2,
  );
}
