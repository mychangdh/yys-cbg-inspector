import type { HeroBaseStats } from "./types";
import type { PairCandidate, PairSearchTree, SearchNode } from "./fastTypes";

const TREE_LEAF_SIZE = 24;

/** 构建固定容量叶节点的配对搜索树，用于快速计算剩余位置的上界。 */
export function buildPairSearchTree(
  pairs: PairCandidate[],
  base: HeroBaseStats,
): PairSearchTree {
  const ordered = [...pairs].sort(
    (left, right) =>
      (base.attack + right.attack) * (base.critDamage + right.critDamage) -
        (base.attack + left.attack) * (base.critDamage + left.critDamage) ||
      right.speed - left.speed ||
      right.critRate - left.critRate,
  );
  const nodes: SearchNode[] = [];
  const build = (start: number, end: number): number => {
    const index = nodes.length;
    const node: SearchNode = {
      start,
      end,
      minAttack: Number.POSITIVE_INFINITY,
      minHealth: Number.POSITIVE_INFINITY,
      minDefense: Number.POSITIVE_INFINITY,
      minSpeed: Number.POSITIVE_INFINITY,
      minCritRate: Number.POSITIVE_INFINITY,
      minCritDamage: Number.POSITIVE_INFINITY,
      minEffectHit: Number.POSITIVE_INFINITY,
      minEffectResistance: Number.POSITIVE_INFINITY,
      maxAttack: Number.NEGATIVE_INFINITY,
      maxHealth: Number.NEGATIVE_INFINITY,
      maxDefense: Number.NEGATIVE_INFINITY,
      maxSpeed: Number.NEGATIVE_INFINITY,
      maxCritRate: Number.NEGATIVE_INFINITY,
      maxCritDamage: Number.NEGATIVE_INFINITY,
      maxEffectHit: Number.NEGATIVE_INFINITY,
      maxEffectResistance: Number.NEGATIVE_INFINITY,
    };
    nodes.push(node);
    for (let cursor = start; cursor < end; cursor += 1) {
      const pair = ordered[cursor];
      node.minAttack = Math.min(node.minAttack, pair.attack);
      node.minHealth = Math.min(node.minHealth, pair.health || 0);
      node.minDefense = Math.min(node.minDefense, pair.defense || 0);
      node.minSpeed = Math.min(node.minSpeed, pair.speed);
      node.minCritRate = Math.min(node.minCritRate, pair.critRate);
      node.minCritDamage = Math.min(node.minCritDamage, pair.critDamage);
      node.minEffectHit = Math.min(node.minEffectHit, pair.effectHit || 0);
      node.minEffectResistance = Math.min(
        node.minEffectResistance,
        pair.effectResistance || 0,
      );
      node.maxAttack = Math.max(node.maxAttack, pair.attack);
      node.maxHealth = Math.max(node.maxHealth!, pair.health || 0);
      node.maxDefense = Math.max(node.maxDefense!, pair.defense || 0);
      node.maxSpeed = Math.max(node.maxSpeed, pair.speed);
      node.maxCritRate = Math.max(node.maxCritRate, pair.critRate);
      node.maxCritDamage = Math.max(node.maxCritDamage, pair.critDamage);
      node.maxEffectHit = Math.max(node.maxEffectHit!, pair.effectHit || 0);
      node.maxEffectResistance = Math.max(
        node.maxEffectResistance!,
        pair.effectResistance || 0,
      );
    }
    if (end - start > TREE_LEAF_SIZE) {
      const middle = start + Math.floor((end - start) / 2);
      node.left = build(start, middle);
      node.right = build(middle, end);
    }
    return index;
  };
  return { pairs: ordered, nodes, root: build(0, ordered.length) };
}
