import type { RelicView } from "@/types";
import type { FastRelic, SearchNode, FastVector } from "./fastTypes";
import type { HeroBaseStats } from "./types";

/** 紧凑搜索的零值向量，所有候选的数值累加都从这里开始。 */
export function emptyFastVector(): FastVector {
  return {
    attack: 0,
    health: 0,
    defense: 0,
    speed: 0,
    critRate: 0,
    critDamage: 0,
    effectHit: 0,
    effectResistance: 0,
  };
}

/** 搜索树内部节点存的是逐字段上界，这里恢复为同一向量结构。 */
export function vectorForSearchNode(node: SearchNode): FastVector {
  return {
    attack: node.maxAttack,
    health: node.maxHealth,
    defense: node.maxDefense,
    speed: node.maxSpeed,
    critRate: node.maxCritRate,
    critDamage: node.maxCritDamage,
    effectHit: node.maxEffectHit,
    effectResistance: node.maxEffectResistance,
  };
}

/** 搜索树节点的逐属性下界，用于整块排除必定超过面板上限的候选对。 */
export function minimumVectorForSearchNode(node: SearchNode): FastVector {
  return {
    attack: node.minAttack,
    health: node.minHealth,
    defense: node.minDefense,
    speed: node.minSpeed,
    critRate: node.minCritRate,
    critDamage: node.minCritDamage,
    effectHit: node.minEffectHit,
    effectResistance: node.minEffectResistance,
  };
}

/** 两个不确定分支合并时只取理论最大值，仅用于安全的乐观上界。 */
export function maximumFastVector(
  left: FastVector,
  right: FastVector,
): FastVector {
  return {
    attack: Math.max(left.attack, right.attack),
    health: Math.max(left.health, right.health),
    defense: Math.max(left.defense, right.defense),
    speed: Math.max(left.speed, right.speed),
    critRate: Math.max(left.critRate, right.critRate),
    critDamage: Math.max(left.critDamage, right.critDamage),
    effectHit: Math.max(left.effectHit, right.effectHit),
    effectResistance: Math.max(left.effectResistance, right.effectResistance),
  };
}

export function addFastVector(target: FastVector, source: FastVector): void {
  target.attack += source.attack;
  target.health += source.health;
  target.defense += source.defense;
  target.speed += source.speed;
  target.critRate += source.critRate;
  target.critDamage += source.critDamage;
  target.effectHit += source.effectHit;
  target.effectResistance += source.effectResistance;
}

export function sumFastVectors(
  left: FastVector,
  right: FastVector,
): FastVector {
  return {
    attack: left.attack + right.attack,
    health: left.health + right.health,
    defense: left.defense + right.defense,
    speed: left.speed + right.speed,
    critRate: left.critRate + right.critRate,
    critDamage: left.critDamage + right.critDamage,
    effectHit: left.effectHit + right.effectHit,
    effectResistance: left.effectResistance + right.effectResistance,
  };
}

export function sumThreeFastVectors(
  left: FastVector,
  right: FastVector,
  extra?: FastVector,
): FastVector {
  return {
    attack: left.attack + right.attack + (extra?.attack || 0),
    health: left.health + right.health + (extra?.health || 0),
    defense: left.defense + right.defense + (extra?.defense || 0),
    speed: left.speed + right.speed + (extra?.speed || 0),
    critRate: left.critRate + right.critRate + (extra?.critRate || 0),
    critDamage: left.critDamage + right.critDamage + (extra?.critDamage || 0),
    effectHit: left.effectHit + right.effectHit + (extra?.effectHit || 0),
    effectResistance:
      left.effectResistance +
      right.effectResistance +
      (extra?.effectResistance || 0),
  };
}

function fastAttributeKey(label = "") {
  if (label.includes("生命加成")) return "healthPercent";
  if (label.includes("生命")) return "health";
  if (label.includes("防御加成")) return "defensePercent";
  if (label.includes("防御")) return "defense";
  if (label.includes("效果命中")) return "effectHit";
  if (label.includes("效果抵抗")) return "effectResistance";
  if (label.includes("攻击加成")) return "attackPercent";
  if (label === "攻击" || label.includes("攻击")) return "attack";
  if (label.includes("速度")) return "speed";
  if (label.includes("暴击伤害") || label.includes("爆伤")) return "critDamage";
  if (label.includes("暴击")) return "critRate";
  return undefined;
}

function addFastAttribute(
  vector: FastVector,
  label: string | undefined,
  value: number | undefined,
  baseStats: HeroBaseStats,
): void {
  const amount = Number(value) || 0;
  switch (fastAttributeKey(label)) {
    case "attack":
      vector.attack += amount;
      break;
    case "attackPercent":
      vector.attack += (baseStats.attack * amount) / 100;
      break;
    case "health":
      vector.health += amount;
      break;
    case "healthPercent":
      vector.health += (baseStats.health * amount) / 100;
      break;
    case "defense":
      vector.defense += amount;
      break;
    case "defensePercent":
      vector.defense += (baseStats.defense * amount) / 100;
      break;
    case "speed":
      vector.speed += amount;
      break;
    case "critRate":
      vector.critRate += amount;
      break;
    case "critDamage":
      vector.critDamage += amount;
      break;
    case "effectHit":
      vector.effectHit += amount;
      break;
    case "effectResistance":
      vector.effectResistance += amount;
      break;
  }
}

/** 御魂向量使用精确强化累计值，逢魔一件套会随单件立即叠加。 */
export function relicToFastVector(
  relic: RelicView,
  baseStats: HeroBaseStats,
): FastRelic {
  const vector = emptyFastVector();
  if (relic.mainAttribute)
    addFastAttribute(
      vector,
      relic.mainAttribute.label,
      relic.mainAttribute.value,
      baseStats,
    );
  const preciseTotals = relic.enhancement?.totals;
  if (preciseTotals?.length)
    preciseTotals.forEach((attribute) =>
      addFastAttribute(vector, attribute.label, attribute.total, baseStats),
    );
  else
    relic.subAttributes?.forEach((attribute) =>
      addFastAttribute(vector, attribute.label, attribute.value, baseStats),
    );
  if (relic.setBonusAttribute)
    addFastAttribute(
      vector,
      relic.setBonusAttribute.label,
      relic.setBonusAttribute.value,
      baseStats,
    );
  return {
    relic,
    suit: relic.suit?.name || "",
    hasOnePieceBonus: Boolean(relic.setBonusAttribute),
    ...vector,
  };
}

export function twoPieceToFastVector(
  text: string | undefined,
  baseStats: HeroBaseStats,
): FastVector {
  const vector = emptyFastVector();
  const value = String(text || "");
  const match = value.match(
    /^(速度|暴击伤害|暴击|攻击加成|攻击)\s*\+?\s*(\d+(?:\.\d+)?)%?$/,
  );
  if (match) addFastAttribute(vector, match[1], Number(match[2]), baseStats);
  if (!match) {
    const extendedMatch = value.match(
      /^(?:生命加成|生命|防御加成|防御|效果命中|效果抵抗)\s*\+?\s*(\d+(?:\.\d+)?)%?$/,
    );
    const label = value.match(/^[^0-9+%]+/)?.[0];
    if (extendedMatch && label)
      addFastAttribute(vector, label, Number(extendedMatch[1]), baseStats);
  }
  return vector;
}

// 兼容极速内核现有调用名，迁移期间保持算法入口不变。
export const addVector = addFastVector;
export const sumVectors = sumFastVectors;
export const sumThreeVectors = sumThreeFastVectors;
export const maximumVector = maximumFastVector;
export const emptyVector = emptyFastVector;
export const vectorForNode = vectorForSearchNode;
export const minimumVectorForNode = minimumVectorForSearchNode;
