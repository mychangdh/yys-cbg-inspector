import type { RelicView } from "@/types";
import { POSITION_ORDER } from "./fixedSuitPlan";
import { metricStatKeys, statKeysForPanelKey } from "./pruning";
import { relicStatValue } from "./relicStats";
import type {
  CalculatorFilters,
  CalculatorMetric,
  PanelConstraintKey,
} from "./types";
import { takeBest } from "./topK";

export type FixedCandidateLimits = {
  candidateLimit: number;
  localReserve: number;
  statReserve: number;
  critDamageReserve: number;
};

/**
 * 为固定套装布局建立安全候选前沿。候选只按原有维度保留，
 * 不改变最终组合的比较规则；每条约束路线都会留下独立通道。
 */
export function selectFixedPatternCandidates(
  matching: RelicView[],
  positionIndex: number,
  metric: CalculatorMetric,
  filters: CalculatorFilters,
  limits: FixedCandidateLimits,
  criticalRateDiverseCandidates: (
    relics: RelicView[],
    metric: CalculatorMetric,
    filters: CalculatorFilters,
  ) => RelicView[],
): RelicView[] {
  const selected: RelicView[] = [];
  const seen = new Set<string>();
  const add = (relic: RelicView) => {
    const id = String(relic.id);
    if (seen.has(id)) return;
    seen.add(id);
    selected.push(relic);
  };
  const addTopBy = (key: string, descending = true) => {
    takeBest(matching, limits.statReserve, (left, right) => {
      const delta = relicStatValue(right, key) - relicStatValue(left, key);
      return descending ? delta : -delta;
    }).forEach(add);
  };

  const relevantKeys = new Set(metricStatKeys(metric));
  Object.entries(filters.panelConstraints || {}).forEach(([rawKey, range]) => {
    const key = rawKey as PanelConstraintKey;
    statKeysForPanelKey(key).forEach((statKey) => relevantKeys.add(statKey));
    if (range?.max !== undefined) {
      statKeysForPanelKey(key).forEach((statKey) => addTopBy(statKey, false));
    }
  });
  relevantKeys.forEach((key) => addTopBy(key));

  const relicsBySuit = new Map<string, RelicView[]>();
  matching.forEach((relic) => {
    const suitName = relic.suit?.name;
    if (!suitName) return;
    const items = relicsBySuit.get(suitName);
    if (items) items.push(relic);
    else relicsBySuit.set(suitName, [relic]);
  });
  relicsBySuit.forEach((items) => {
    if (items[0]) add(items[0]);
  });

  matching.slice(0, limits.localReserve).forEach(add);
  if (
    positionIndex === POSITION_ORDER.length - 1 &&
    (metric === "damage" || metric === "healing" || metric === "defenseOutput")
  ) {
    matching
      .filter((relic) => relic.mainAttribute?.label === "暴击伤害")
      .slice(0, limits.critDamageReserve)
      .forEach(add);
  }
  criticalRateDiverseCandidates(matching, metric, filters).forEach(add);
  return selected.slice(0, limits.candidateLimit);
}
