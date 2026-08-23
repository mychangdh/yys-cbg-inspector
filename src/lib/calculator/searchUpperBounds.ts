import type {
  CalculatorFilters,
  CalculatorMetric,
  HeroBaseStats,
  PanelConstraintKey,
} from "./types";
import type { StatBag } from "./relicStats";

export type BaseStatsWithBuffs = HeroBaseStats & {
  buffPercents?: Pick<
    StatBag,
    "attackPercent" | "healthPercent" | "defensePercent"
  >;
};

function statValueWithFuture(
  stats: StatBag,
  key: string,
  future?: StatBag,
  potentialBonus?: StatBag,
): number {
  return (
    (stats[key] || 0) + (future?.[key] || 0) + (potentialBonus?.[key] || 0)
  );
}

export function panelValueFromStats(
  base: BaseStatsWithBuffs,
  stats: StatBag,
  key: PanelConstraintKey,
  future?: StatBag,
  potentialBonus?: StatBag,
): number {
  if (key === "attack" || key === "health" || key === "defense") {
    const percentKey = `${key}Percent` as
      "attackPercent" | "healthPercent" | "defensePercent";
    const percent =
      statValueWithFuture(stats, percentKey, future, potentialBonus) +
      (base.buffPercents?.[percentKey] || 0);
    return (
      base[key] * (1 + percent / 100) +
      statValueWithFuture(stats, key, future, potentialBonus)
    );
  }
  return base[key] + statValueWithFuture(stats, key, future, potentialBonus);
}

export function constrainedMetricUpperBound(
  base: BaseStatsWithBuffs,
  stats: StatBag,
  future: StatBag,
  potentialBonus: StatBag,
  metric: CalculatorMetric,
  constraints: CalculatorFilters["panelConstraints"],
): number {
  const upperPanelValue = (key: PanelConstraintKey) => {
    const value = panelValueFromStats(base, stats, key, future, potentialBonus);
    const maximum = constraints?.[key]?.max;
    return maximum === undefined ? value : Math.min(value, maximum);
  };
  if (metric === "damage") {
    return upperPanelValue("attack") * upperPanelValue("critDamage") * 0.01;
  }
  if (metric === "healing") {
    return upperPanelValue("health") * upperPanelValue("critDamage") * 0.01;
  }
  if (metric === "defenseOutput") {
    return upperPanelValue("defense") * upperPanelValue("critDamage") * 0.01;
  }
  if (metric === "hitResistance") {
    return upperPanelValue("effectHit") + upperPanelValue("effectResistance");
  }
  return upperPanelValue(metric);
}

/**
 * 判断当前属性与后续号位理论最大属性是否仍有机会满足面板范围。
 * 它刻意不计算指标上界，供尚未拥有可比较分数下界的热路径使用。
 */
export function cannotSatisfyPanelConstraints(
  base: BaseStatsWithBuffs,
  stats: StatBag,
  future: StatBag,
  potentialBonus: StatBag,
  constraints: CalculatorFilters["panelConstraints"],
): boolean {
  for (const [rawKey, range] of Object.entries(constraints || {})) {
    const key = rawKey as PanelConstraintKey;
    if (
      range?.max !== undefined &&
      panelValueFromStats(base, stats, key) > range.max
    ) {
      return true;
    }
    if (
      range?.min !== undefined &&
      panelValueFromStats(base, stats, key, future, potentialBonus) <
        range.min
    ) {
      return true;
    }
  }
  return false;
}

export function cannotBeatFastResult(
  base: BaseStatsWithBuffs,
  stats: StatBag,
  future: StatBag,
  potentialBonus: StatBag,
  metric: CalculatorMetric,
  constraints: CalculatorFilters["panelConstraints"],
  bestScore: number,
): boolean {
  if (
    cannotSatisfyPanelConstraints(
      base,
      stats,
      future,
      potentialBonus,
      constraints,
    )
  )
    return true;
  return (
    constrainedMetricUpperBound(
      base,
      stats,
      future,
      potentialBonus,
      metric,
      constraints,
    ) < bestScore
  );
}
