import type { RelicView } from "../../types";
import type { CalculatorFilters } from "./types";

/**
 * 返回当前候选池中可以实际触发两件套的御魂套装。
 * 两件套必须覆盖两个不同号位，避免把物理上无法组成的套装交给后续搜索。
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

/**
 * 估算通用搜索的候选规模，用于在进入 Worker 前展示稳定的进度总量。
 * 这里只做筛选计数，不参与候选排序，也不会改变最终搜索结果。
 */
export function generalSearchWorkEstimate(
  relicsByPosition: Record<string, RelicView[]>,
  filters: CalculatorFilters,
  positionOrder: readonly number[],
): number {
  let estimate = 1;
  for (const position of positionOrder) {
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
