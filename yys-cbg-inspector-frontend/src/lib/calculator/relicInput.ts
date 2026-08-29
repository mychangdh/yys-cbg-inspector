import type { RelicDataset, RelicView } from "@/types";

/**
 * 构造传递给计算 Worker 的最小御魂数据集。
 *
 * 强化过程快照只用于界面详情，在 Worker 中反复结构化克隆会扩大移动端内存占用；
 * 计算只依赖精确副属性累计值，因此只保留 totals。
 */
export function createCalculationRelics(
  relicsByPosition: RelicDataset["relicsByPosition"],
): RelicDataset["relicsByPosition"] {
  return Object.fromEntries(
    Object.entries(relicsByPosition).map(([position, relics]) => [
      position,
      relics
        .filter(
          (relic) => (relic.quality || 0) >= 6 && (relic.level || 0) >= 15,
        )
        .map((relic): RelicView => ({
          id: relic.id,
          level: relic.level,
          quality: relic.quality,
          position: relic.position,
          suit: relic.suit
            ? {
                id: relic.suit.id,
                name: relic.suit.name,
                isTwoPieceSet: relic.suit.isTwoPieceSet,
              }
            : undefined,
          mainAttribute: relic.mainAttribute,
          subAttributes: relic.subAttributes,
          setBonusAttribute: relic.setBonusAttribute,
          enhancement: relic.enhancement?.totals?.length
            ? { totals: relic.enhancement.totals }
            : undefined,
        })),
    ]),
  ) as RelicDataset["relicsByPosition"];
}
