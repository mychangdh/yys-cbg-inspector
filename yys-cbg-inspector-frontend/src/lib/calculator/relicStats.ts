import type { RelicView } from "../../types";

export type StatBag = Record<string, number>;
export const STAT_VECTOR_KEYS = [
  "attack",
  "health",
  "defense",
  "speed",
  "critRate",
  "critDamage",
  "attackPercent",
  "healthPercent",
  "defensePercent",
  "effectHit",
  "effectResistance",
] as const;
export const STAT_VECTOR_INDEX = new Map<string, number>(
  STAT_VECTOR_KEYS.map((key, index) => [key, index]),
);
export const STAT_VECTOR = {
  attack: 0,
  health: 1,
  defense: 2,
  speed: 3,
  critRate: 4,
  critDamage: 5,
  attackPercent: 6,
  healthPercent: 7,
  defensePercent: 8,
  effectHit: 9,
  effectResistance: 10,
} as const;
export type StatVector = Float64Array;

const relicStatsCache = new WeakMap<RelicView, StatBag>();
const relicStatEntriesCache = new WeakMap<RelicView, [string, number][]>();
const relicStatVectorCache = new WeakMap<RelicView, StatVector>();

export function createEmptyStatBag(): StatBag {
  return {
    attack: 0,
    health: 0,
    defense: 0,
    speed: 0,
    critRate: 0,
    critDamage: 0,
    attackPercent: 0,
    healthPercent: 0,
    defensePercent: 0,
    effectHit: 0,
    effectResistance: 0,
  };
}

export function canonical(label = ""): string {
  if (label.includes("速度")) return "speed";
  if (label.includes("暴击伤害") || label.includes("爆伤")) return "critDamage";
  if (label.includes("暴击")) return "critRate";
  if (label.includes("攻击加成")) return "attackPercent";
  if (label === "攻击" || label.includes("攻击")) return "attack";
  if (label.includes("生命加成")) return "healthPercent";
  if (label === "生命" || label.includes("生命")) return "health";
  if (label.includes("防御加成")) return "defensePercent";
  if (label === "防御" || label.includes("防御")) return "defense";
  if (label.includes("效果命中")) return "effectHit";
  if (label.includes("效果抵抗")) return "effectResistance";
  return "other";
}

export function addAttribute(
  stats: StatBag,
  attribute: RelicView["mainAttribute"],
): void {
  if (!attribute) return;
  const key = canonical(attribute.label);
  if (key !== "other")
    stats[key] = (stats[key] || 0) + Number(attribute.value || 0);
}

function addSubAttributes(stats: StatBag, relic: RelicView): void {
  const preciseTotals = relic.enhancement?.totals || [];
  if (preciseTotals.length) {
    preciseTotals.forEach((attribute) => {
      const key = canonical(attribute.label);
      if (key !== "other")
        stats[key] = (stats[key] || 0) + Number(attribute.total || 0);
    });
    return;
  }
  (relic.subAttributes || []).forEach((attribute) =>
    addAttribute(stats, attribute),
  );
}

export function relicStatsFor(relic: RelicView): StatBag {
  const cached = relicStatsCache.get(relic);
  if (cached) return cached;
  const stats: StatBag = {};
  addAttribute(stats, relic.mainAttribute);
  addSubAttributes(stats, relic);
  addAttribute(stats, relic.setBonusAttribute);
  relicStatsCache.set(relic, stats);
  return stats;
}

export function relicStatEntriesFor(relic: RelicView): [string, number][] {
  const cached = relicStatEntriesCache.get(relic);
  if (cached) return cached;
  const entries = Object.entries(relicStatsFor(relic));
  relicStatEntriesCache.set(relic, entries);
  return entries;
}

export function relicStatVectorFor(relic: RelicView): StatVector {
  const cached = relicStatVectorCache.get(relic);
  if (cached) return cached;
  const vector = new Float64Array(STAT_VECTOR_KEYS.length);
  for (const [key, value] of relicStatEntriesFor(relic)) {
    const index = STAT_VECTOR_INDEX.get(key);
    if (index !== undefined) vector[index] = value;
  }
  relicStatVectorCache.set(relic, vector);
  return vector;
}

export function relicStatValue(relic: RelicView, key: string): number {
  const index = STAT_VECTOR_INDEX.get(key);
  return index === undefined
    ? relicStatsFor(relic)[key] || 0
    : relicStatVectorFor(relic)[index];
}

export function calculateRelicStatTotals(relic: RelicView): StatBag {
  return { ...relicStatsFor(relic) };
}

export function addStats(target: StatBag, source: StatBag): void {
  Object.entries(source).forEach(([key, value]) => {
    target[key] = (target[key] || 0) + value;
  });
}

export function addRelic(stats: StatBag, relic: RelicView): void {
  for (const [key, value] of relicStatEntriesFor(relic)) {
    stats[key] = (stats[key] || 0) + value;
  }
}

/**
 * 固定套装 Beam 会在一次搜索中创建数十万到数百万个中间状态。对象展开会枚举
 * 属性并产生不稳定的隐藏类，GC 成本会随御魂仓库扩大得很明显。
 *
 * 计算器的属性集合固定为 STAT_VECTOR_KEYS，因此这里使用稳定字段顺序复制，
 * 再叠加已经缓存好的御魂向量。返回值仍是 StatBag，调用方无需改变面板与约束
 * 计算逻辑。
 */
export function cloneStatsWithRelic(stats: StatBag, relic: RelicView): StatBag {
  const vector = relicStatVectorFor(relic);
  return {
    attack: (stats.attack || 0) + vector[STAT_VECTOR.attack],
    health: (stats.health || 0) + vector[STAT_VECTOR.health],
    defense: (stats.defense || 0) + vector[STAT_VECTOR.defense],
    speed: (stats.speed || 0) + vector[STAT_VECTOR.speed],
    critRate: (stats.critRate || 0) + vector[STAT_VECTOR.critRate],
    critDamage: (stats.critDamage || 0) + vector[STAT_VECTOR.critDamage],
    attackPercent:
      (stats.attackPercent || 0) + vector[STAT_VECTOR.attackPercent],
    healthPercent:
      (stats.healthPercent || 0) + vector[STAT_VECTOR.healthPercent],
    defensePercent:
      (stats.defensePercent || 0) + vector[STAT_VECTOR.defensePercent],
    effectHit: (stats.effectHit || 0) + vector[STAT_VECTOR.effectHit],
    effectResistance:
      (stats.effectResistance || 0) + vector[STAT_VECTOR.effectResistance],
  };
}
