import type {
  CalculatorFilters,
  CalculatorMetric,
  HeroBaseStats,
} from "./types";
import type { FastDimension, FastVector } from "./fastTypes";

const EPSILON = 1e-9;

export function panelForVector(base: HeroBaseStats, vector: FastVector) {
  const buffPercents = (
    base as HeroBaseStats & {
      buffPercents?: Partial<
        Record<"attackPercent" | "healthPercent" | "defensePercent", number>
      >;
    }
  ).buffPercents;
  return {
    attack:
      base.attack * (1 + (buffPercents?.attackPercent || 0) / 100) +
      vector.attack,
    health:
      base.health * (1 + (buffPercents?.healthPercent || 0) / 100) +
      vector.health,
    defense:
      base.defense * (1 + (buffPercents?.defensePercent || 0) / 100) +
      vector.defense,
    speed: base.speed + vector.speed,
    critRate: base.critRate + vector.critRate,
    critDamage: base.critDamage + vector.critDamage,
    effectHit: base.effectHit + (vector.effectHit || 0),
    effectResistance: base.effectResistance + (vector.effectResistance || 0),
  };
}

export function fastMetricValue(
  panel: ReturnType<typeof panelForVector>,
  metric: CalculatorMetric,
) {
  if (metric === "attack") return panel.attack;
  if (metric === "health") return panel.health;
  if (metric === "defense") return panel.defense;
  if (metric === "speed") return panel.speed;
  if (metric === "critRate") return panel.critRate;
  if (metric === "critDamage") return panel.critDamage;
  if (metric === "effectHit") return panel.effectHit;
  if (metric === "effectResistance") return panel.effectResistance;
  if (metric === "hitResistance")
    return panel.effectHit + panel.effectResistance;
  if (metric === "healing") return panel.health * panel.critDamage * 0.01;
  if (metric === "defenseOutput")
    return panel.defense * panel.critDamage * 0.01;
  return panel.attack * panel.critDamage * 0.01;
}

export function fastMetricDimensions(
  metric: CalculatorMetric,
): FastDimension[] {
  if (metric === "damage") return ["attack", "critDamage"];
  if (metric === "healing") return ["health", "critDamage"];
  if (metric === "defenseOutput") return ["defense", "critDamage"];
  if (metric === "hitResistance") return ["effectHit", "effectResistance"];
  return [metric];
}

export function fastSearchDimensions(
  baseStats: HeroBaseStats,
  metric: CalculatorMetric,
  constraints: CalculatorFilters["panelConstraints"],
) {
  const dimensions = new Set<FastDimension>(fastMetricDimensions(metric));
  Object.entries(constraints || {}).forEach(([rawKey, range]) => {
    const key = rawKey as FastDimension;
    // 下限需要记录可累加的补足量；上限即使不是当前指标，也必须进入前沿维度，
    // 以便双向支配比较保留较低数值的可行候选。
    if (
      range?.max !== undefined ||
      (range?.min !== undefined && range.min > baseStats[key])
    )
      dimensions.add(key);
  });
  dimensions.add("critRate");
  return [...dimensions];
}

export function fastSatisfiesConstraints(
  panel: ReturnType<typeof panelForVector>,
  constraints: CalculatorFilters["panelConstraints"],
) {
  return Object.entries(constraints || {}).every(([rawKey, range]) => {
    const key = rawKey as keyof ReturnType<typeof panelForVector>;
    const value = panel[key];
    return (
      (range?.min === undefined || value >= range.min) &&
      (range?.max === undefined || value <= range.max)
    );
  });
}

export function fastUpperPanelForVector(
  base: HeroBaseStats,
  vector: FastVector,
  constraints: CalculatorFilters["panelConstraints"],
) {
  const panel = panelForVector(base, vector);
  Object.entries(constraints || {}).forEach(([rawKey, range]) => {
    if (range?.max === undefined) return;
    const key = rawKey as keyof typeof panel;
    panel[key] = Math.min(panel[key], range.max);
  });
  return panel;
}

export function fastCanReachConstraints(
  base: HeroBaseStats,
  vector: FastVector,
  constraints: CalculatorFilters["panelConstraints"],
) {
  const panel = panelForVector(base, vector);
  return Object.entries(constraints || {}).every(([rawKey, range]) => {
    const key = rawKey as keyof typeof panel;
    return range?.min === undefined || panel[key] >= range.min - EPSILON;
  });
}

export function fastCanStillSatisfyConstraints(
  currentPanel: ReturnType<typeof panelForVector>,
  upperPanel: ReturnType<typeof panelForVector>,
  constraints: CalculatorFilters["panelConstraints"],
) {
  return Object.entries(constraints || {}).every(([rawKey, range]) => {
    const key = rawKey as keyof typeof currentPanel;
    return (
      (range?.min === undefined || upperPanel[key] >= range.min - EPSILON) &&
      (range?.max === undefined || currentPanel[key] <= range.max + EPSILON)
    );
  });
}
