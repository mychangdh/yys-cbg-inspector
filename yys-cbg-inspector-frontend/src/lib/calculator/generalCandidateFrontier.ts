import type { RelicView } from "@/types";
import type {
  CalculatorFilters,
  CalculatorMetric,
  HeroBaseStats,
  PanelConstraintKey,
} from "./types";

type DependencyFunction = (...args: any[]) => any;

export type GeneralCandidateDependencies = {
  positionCount: number;
  maxCandidatesPerPosition: number;
  requiredCandidateReserve: number;
  compositeSlotSixCritDamageReserve: number;
  requiredConstraintCandidateReserve: number;
  usesCriticalRateCap: DependencyFunction;
  criticalRateDiverseCandidates: DependencyFunction;
  panelFor: DependencyFunction;
  relicStatsFor: DependencyFunction;
  takeBest: DependencyFunction;
};

export function prepareGeneralCandidates(
  eligibleRelics: RelicView[][],
  base: HeroBaseStats,
  metric: CalculatorMetric,
  filters: CalculatorFilters,
  deps: GeneralCandidateDependencies,
): RelicView[][] {
  const candidates = eligibleRelics.map((_, index) => {
    const position = index + 1;
    const ranked = eligibleRelics[index];
    const requiredCandidateGroups: RelicView[][] = [];
    if (filters.requiredFourPiece) {
      requiredCandidateGroups.push(
        ranked.filter(
          (relic) => relic.suit?.name === filters.requiredFourPiece,
        ),
      );
    }
    for (const name of filters.requiredTwoPieceNames || []) {
      requiredCandidateGroups.push(
        ranked.filter((relic) => relic.suit?.name === name),
      );
    }
    for (const attribute of filters.requiredTwoPieceAttributes || []) {
      requiredCandidateGroups.push(
        ranked.filter(
          (relic) =>
            relic.suit?.name !== filters.requiredFourPiece &&
            filters.suitTwoPieceAttributes?.get(relic.suit?.name || "") ===
              attribute,
        ),
      );
    }
    const required = requiredCandidateGroups.flatMap((items) =>
      items.slice(0, deps.requiredCandidateReserve),
    );
    // 伤害、治疗等复合指标都依赖爆伤。为六号位爆伤主属性单独预留候选，
    // 避免御魂很多或套装筛选时在搜索开始前就丢掉正确路径。
    const damageSlotSixCritDamage =
      position === 6 && deps.usesCriticalRateCap(metric)
        ? ranked
            .filter((relic) => relic.mainAttribute?.label === "暴击伤害")
            .slice(0, deps.compositeSlotSixCritDamageReserve)
        : [];
    const criticalRateDiversity = deps.criticalRateDiverseCandidates(
      ranked,
      metric,
      filters,
    );
    const constrained = Object.entries(filters.panelConstraints || {})
      .filter(([rawKey, range]) => {
        const key = rawKey as PanelConstraintKey;

        return range?.min !== undefined && range.min > base[key];
      })
      .flatMap(([rawKey]) => {
        const key = rawKey as PanelConstraintKey;
        return deps.takeBest(ranked, 10, (left, right) => {
          return (
            deps.panelFor(base, deps.relicStatsFor(right))[key] -
            deps.panelFor(base, deps.relicStatsFor(left))[key]
          );
        });
      });
    // 指定两件套或四件套可能需要局部指标不高、但暴击或命中很高的御魂，
    // 这些套装分支也必须在候选数量限制前保留下来。
    const requiredConstrained = Object.entries(filters.panelConstraints || {})
      .filter(([rawKey, range]) => {
        const key = rawKey as PanelConstraintKey;
        return range?.min !== undefined && range.min > base[key];
      })
      .flatMap(([rawKey]) => {
        const key = rawKey as PanelConstraintKey;
        return requiredCandidateGroups.flatMap((items) =>
          deps.takeBest(
            items,
            deps.requiredConstraintCandidateReserve,
            (left, right) => {
              return (
                deps.panelFor(base, deps.relicStatsFor(right))[key] -
                deps.panelFor(base, deps.relicStatsFor(left))[key]
              );
            },
          ),
        );
      });
    return [
      ...required,
      ...damageSlotSixCritDamage,
      ...criticalRateDiversity,
      ...requiredConstrained,
      ...constrained,
      ...ranked,
    ]
      .filter(
        (relic, index, items) =>
          items.findIndex((item) => item.id === relic.id) === index,
      )
      .slice(0, deps.maxCandidatesPerPosition);
  });
  return candidates;
}
