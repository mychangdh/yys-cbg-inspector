import type { RelicView } from "../../types";
import type {
  CalculatedPanel,
  CalculatorExtraAttributeKey,
  CalculatorMetric,
  HeroBaseStats,
  PanelConstraintKey,
} from "./types";
import { addAttribute, addRelic, type StatBag } from "./relicStats";
import { parseTwoPieceAttribute } from "./setRules";

export type PanelStatBag = Record<string, number>;

export type BufferedHeroBaseStats = HeroBaseStats & {
  buffPercents?: Pick<
    PanelStatBag,
    "attackPercent" | "healthPercent" | "defensePercent"
  >;
};

/** 计算真实御魂组合面板，搜索和详情页共用这一条规则链。 */
export function calculateRelicPanel({
  baseStats,
  relics,
  suitTwoPieceAttributes,
  extraAttributes,
}: {
  baseStats: HeroBaseStats;
  relics: readonly RelicView[];
  suitTwoPieceAttributes?: ReadonlyMap<string, string>;
  extraAttributes?: Partial<Record<CalculatorExtraAttributeKey, number>>;
}): CalculatedPanel {
  const stats: StatBag = {};
  const suitCounts = new Map<string, number>();
  relics.forEach((relic) => {
    addRelic(stats, relic);
    const suitName = relic.suit?.name;
    if (!suitName) return;
    const count = (suitCounts.get(suitName) || 0) + 1;
    suitCounts.set(suitName, count);
    if (count === 2 && !relic.setBonusAttribute) {
      addAttribute(
        stats,
        parseTwoPieceAttribute(suitTwoPieceAttributes?.get(suitName)),
      );
    }
  });
  return calculatePanelFromStats(
    applyExtraPanelAttributes(baseStats, extraAttributes),
    stats,
  );
}

/** 额外属性统一在这里归一化，避免不同搜索分支处理负值的规则不一致。 */
export function applyExtraPanelAttributes(
  base: HeroBaseStats,
  extraAttributes?: Partial<Record<CalculatorExtraAttributeKey, number>>,
): BufferedHeroBaseStats {
  if (!extraAttributes || Object.keys(extraAttributes).length === 0)
    return base;

  const value = (key: CalculatorExtraAttributeKey): number =>
    Math.max(0, Number(extraAttributes[key] || 0));

  return {
    ...base,
    buffPercents: {
      attackPercent: value("attackPercent"),
      healthPercent: value("healthPercent"),
      defensePercent: value("defensePercent"),
    },
    speed: base.speed + value("speed"),
    critRate: base.critRate + value("critRate"),
    critDamage: base.critDamage + value("critDamage"),
    effectHit: base.effectHit + value("effectHit"),
    effectResistance: base.effectResistance + value("effectResistance"),
  };
}

/** 百分比词条只乘式神基础面板，平坦词条在百分比计算之后相加。 */
export function calculatePanelFromStats(
  base: BufferedHeroBaseStats,
  stats: PanelStatBag,
): CalculatedPanel {
  const buffs: Partial<
    Pick<PanelStatBag, "attackPercent" | "healthPercent" | "defensePercent">
  > = base.buffPercents || {};
  const attackPercent = (stats.attackPercent || 0) + (buffs.attackPercent || 0);
  const healthPercent = (stats.healthPercent || 0) + (buffs.healthPercent || 0);
  const defensePercent =
    (stats.defensePercent || 0) + (buffs.defensePercent || 0);

  return {
    attack: base.attack * (1 + attackPercent / 100) + (stats.attack || 0),
    health: base.health * (1 + healthPercent / 100) + (stats.health || 0),
    defense: base.defense * (1 + defensePercent / 100) + (stats.defense || 0),
    speed: base.speed + (stats.speed || 0),
    critRate: base.critRate + (stats.critRate || 0),
    critDamage: base.critDamage + (stats.critDamage || 0),
    effectHit: base.effectHit + (stats.effectHit || 0),
    effectResistance: base.effectResistance + (stats.effectResistance || 0),
    attackPercent,
    healthPercent,
    defensePercent,
    flatAttack: stats.attack || 0,
    flatHealth: stats.health || 0,
    flatDefense: stats.defense || 0,
  };
}

export function calculatePanelMetric(
  panel: CalculatedPanel,
  metric: CalculatorMetric,
): number {
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

/** 面板上下限是闭区间，等于边界的组合必须保留。 */
export function satisfiesPanelRange(
  panel: CalculatedPanel,
  constraints:
    | Partial<Record<PanelConstraintKey, { min?: number; max?: number }>>
    | undefined,
): boolean {
  return Object.entries(constraints || {}).every(([rawKey, range]) => {
    const key = rawKey as PanelConstraintKey;
    const value = panel[key];
    return !(
      (range?.min !== undefined && value < range.min) ||
      (range?.max !== undefined && value > range.max)
    );
  });
}
