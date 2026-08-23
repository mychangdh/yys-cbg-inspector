import type { RelicView } from "../../types";
import { relicStatVectorFor, STAT_VECTOR } from "./relicStats";
import type { BeamState } from "./fixedSuitState";
import type {
  CalculatorFilters,
  CalculatorMetric,
  HeroBaseStats,
} from "./types";

/** 暴击相关指标统一使用同一套满暴约束与溢出排序规则。 */
export function usesCriticalRateCap(metric: CalculatorMetric): boolean {
  return (
    metric === "damage" || metric === "healing" || metric === "defenseOutput"
  );
}

export function hasFullCriticalRateConstraint(
  filters: CalculatorFilters,
  metric: CalculatorMetric,
): boolean {
  return (
    usesCriticalRateCap(metric) &&
    (filters.panelConstraints?.critRate?.min || 0) >= 100
  );
}

export function rawCriticalRate(state: BeamState, base: HeroBaseStats): number {
  return base.critRate + (state.stats.critRate || 0);
}

export function criticalRateBucket(
  state: BeamState,
  base: HeroBaseStats,
): number {
  return Math.floor(rawCriticalRate(state, base) + Number.EPSILON);
}

export function criticalRateOverflow(
  state: BeamState,
  base: HeroBaseStats,
): number {
  return Math.max(0, rawCriticalRate(state, base) - 100);
}

export function compareCriticalOverflow(
  left: BeamState,
  right: BeamState,
  base: HeroBaseStats,
  metric: CalculatorMetric,
): number {
  if (!usesCriticalRateCap(metric)) return 0;
  return criticalRateOverflow(left, base) - criticalRateOverflow(right, base);
}

/** 为满暴搜索保留不同暴击和暴伤区间内的候选。 */
export function criticalRateDiverseCandidates(
  relics: RelicView[],
  metric: CalculatorMetric,
  filters: CalculatorFilters,
): RelicView[] {
  if (!hasFullCriticalRateConstraint(filters, metric)) return [];
  const groups = new Map<string, RelicView[]>();
  relics.forEach((relic) => {
    const vector = relicStatVectorFor(relic);
    const critRate = vector[STAT_VECTOR.critRate];
    const critDamage = vector[STAT_VECTOR.critDamage];
    const bucket = `${Math.floor(critRate + Number.EPSILON)}|${Math.floor(
      critDamage / 5,
    )}`;
    const group = groups.get(bucket);
    if (group) group.push(relic);
    else groups.set(bucket, [relic]);
  });
  return [...groups.values()].flatMap((items) => items.slice(0, 2));
}
