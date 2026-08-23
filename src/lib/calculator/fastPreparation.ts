import type { RelicView } from "../../types";
import type { CalculatorFilters, HeroBaseStats } from "./types";
import type { FastDimension, FastRelic, FastVector } from "./fastTypes";
import { dominatesOnDimensions } from "./paretoPrimitives";

export function isFastRelicEligible(
  relic: RelicView,
  position: number,
  filters: CalculatorFilters,
): boolean {
  if (
    (relic.quality || 0) < filters.quality ||
    (relic.level || 0) < filters.level
  )
    return false;
  const selected = filters.selectedRelicIds?.[position];
  if (selected?.size && !selected.has(String(relic.id))) return false;
  if (filters.suitName && relic.suit?.name !== filters.suitName) return false;
  const allowedMain = filters.mainAttributes[position as 2 | 4 | 6];
  return (
    !allowedMain?.length ||
    allowedMain.includes(relic.mainAttribute?.label || "")
  );
}

export function fixedFourPiecePatterns(indexes?: number[]): boolean[][] {
  const all: boolean[][] = [];
  for (let mask = 0; mask < 1 << 6; mask += 1) {
    let count = 0;
    const pattern = Array.from({ length: 6 }, (_item, index) => {
      const selected = Boolean(mask & (1 << index));
      count += Number(selected);
      return selected;
    });
    if (count === 4) all.push(pattern);
  }
  return indexes?.length
    ? indexes.flatMap((index) => (all[index] ? [all[index]] : []))
    : all;
}

export function fastRelicDominates(
  left: FastRelic,
  right: FastRelic,
  dimensions: readonly FastDimension[],
): boolean {
  return dominatesOnDimensions(left, right, dimensions);
}

export function removeFastDominated<T extends FastVector>(
  items: T[],
  dimensions: readonly FastDimension[],
  paretoFrontier: <U extends FastVector>(
    values: U[],
    keys: readonly FastDimension[],
  ) => U[],
): T[] {
  return paretoFrontier(items, dimensions);
}

export function removeFastDominatedSameSuit(
  relics: FastRelic[],
  dimensions: readonly FastDimension[],
  paretoFrontier: <U extends FastVector>(
    values: U[],
    keys: readonly FastDimension[],
  ) => U[],
): FastRelic[] {
  const bySuit = new Map<string, FastRelic[]>();
  relics.forEach((relic) => {
    const key = `${relic.suit}|${relic.hasOnePieceBonus ? "one" : "normal"}`;
    bySuit.set(key, [...(bySuit.get(key) || []), relic]);
  });
  return [...bySuit.values()].flatMap((group) =>
    paretoFrontier(group, dimensions),
  );
}

/**
 * 上限约束不能沿用“数值越大越好”的普通支配关系。
 *
 * 例如攻击存在上限时，攻击更高的御魂不一定优于攻击更低的御魂：前者可能会让
 * 整套面板超限。将上限属性投影为相反数后，统一使用“投影值越大越好”的帕累托
 * 前沿。这样候选 A 只有在正向属性不低于 B、且每项上限属性都不高于 B 时才支配 B，
 * 既不会删除可行解，也不会把每个攻击值拆成独立分组而放大搜索规模。
 */
export function paretoFrontierWithExactDimensions<T extends FastVector>(
  values: readonly T[],
  dominanceDimensions: readonly FastDimension[],
  exactDimensions: readonly FastDimension[],
  paretoFrontier: <U extends FastVector>(
    values: U[],
    dimensions: readonly FastDimension[],
  ) => U[],
): T[] {
  if (!exactDimensions.length) {
    return paretoFrontier([...values], dominanceDimensions);
  }
  const groups = new Map<string, T[]>();
  values.forEach((value) => {
    // 上限和指标同时依赖的维度没有统一的优劣方向。只有该维度贡献严格相等，
    // 才允许其他维度更强的候选将它支配，避免攻击上限组合被提前删除。
    const key = exactDimensions
      .map((dimension) => `${dimension}=${value[dimension]}`)
      .join("|");
    const group = groups.get(key);
    if (group) group.push(value);
    else groups.set(key, [value]);
  });
  return [...groups.values()].flatMap((group) =>
    paretoFrontier(group, dominanceDimensions),
  );
}

export function fastRelicPriority(
  relic: FastVector,
  base: HeroBaseStats,
): number {
  return (
    (base.attack + relic.attack) * (base.critDamage + relic.critDamage) +
    (base.health + (relic.health || 0)) * 0.01 +
    (base.defense + (relic.defense || 0)) * 0.01 +
    relic.speed * 24 +
    relic.critRate * 18 +
    relic.critDamage * 12 +
    (relic.effectHit || 0) * 6 +
    (relic.effectResistance || 0) * 6
  );
}
