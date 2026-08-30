import type {
  CalculatorFilters,
  CalculatorMetric,
  CalculatorResult,
} from "./types";
import { satisfiesPanelRange } from "./panel";

/** 合并 Worker 结果并给出稳定排名，组合签名按御魂 ID 去重。 */
export function prioritizeCalculatorResults(
  results: readonly CalculatorResult[],
  filters: CalculatorFilters,
  metricOrResultLimit: CalculatorMetric | number,
  legacyResultLimit?: number,
): CalculatorResult[] {
  // metric 仅为兼容旧搜索入口保留，排序规则仍只依赖结果指标和暴击溢出。
  const resultLimit =
    typeof metricOrResultLimit === "number"
      ? metricOrResultLimit
      : (legacyResultLimit ?? 10);
  const uniqueResults: CalculatorResult[] = [];
  const seen = new Set<string>();

  results.forEach((result) => {
    if (!satisfiesPanelRange(result.panel, filters.panelConstraints)) return;
    const signature = result.relics
      .map((relic) => String(relic.id))
      .sort()
      .join("|");
    if (seen.has(signature)) return;
    seen.add(signature);
    uniqueResults.push(result);
  });

  return uniqueResults
    .sort(
      (left, right) =>
        right.score - left.score ||
        (left.criticalRateOverflow || 0) - (right.criticalRateOverflow || 0),
    )
    .slice(0, resultLimit);
}
