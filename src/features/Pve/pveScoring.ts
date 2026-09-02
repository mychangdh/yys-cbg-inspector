import type {
  PveScoredRelic,
  PveSuitScoreSummary,
  RelicDataset,
  RelicView,
} from "@/types";

export const defaultFourPieceSuitNames = [
  "狂骨",
  "海月火玉",
  "伤魂鸟",
  "破势",
  "隐念",
  "镇墓兽",
  "片叶之苇",
];

export const fixedOmaSuitNames = ["土蜘蛛", "荒骷髅", "鬼灵歌伎"];

const pveEffectiveAttributeLabels = new Set(["攻击加成", "暴击", "暴击伤害"]);

/** PVE 输出只计算攻击加成、暴击和暴击伤害三类有效副属性。 */
function getPveEffectiveSubAttributeCount(relic: RelicView) {
  const totals = relic.enhancement?.totals;
  if (totals?.length) {
    return totals.reduce(
      (count, attribute) =>
        count +
        (pveEffectiveAttributeLabels.has(attribute.label)
          ? attribute.count
          : 0),
      0,
    );
  }

  return (relic.subAttributes || []).filter((attribute) =>
    pveEffectiveAttributeLabels.has(attribute.label),
  ).length;
}

export function getPveEffectiveGrowthTotal(relic: RelicView) {
  const totals = relic.enhancement?.totals;
  if (totals?.length) {
    return totals.reduce(
      (total, attribute) =>
        total +
        (pveEffectiveAttributeLabels.has(attribute.label)
          ? attribute.total
          : 0),
      0,
    );
  }

  return (relic.subAttributes || []).reduce(
    (total, attribute) =>
      total +
      (pveEffectiveAttributeLabels.has(attribute.label) ? attribute.value : 0),
    0,
  );
}

export function scorePveRelic(relic: RelicView): PveScoredRelic | null {
  const position = relic.position || 0;
  const isOmaRelic = Boolean(relic.setBonusAttribute);
  const isOutputOmaBonus =
    isOmaRelic &&
    pveEffectiveAttributeLabels.has(relic.setBonusAttribute?.label || "");

  if (
    relic.quality !== 6 ||
    relic.level !== 15 ||
    ([2, 4].includes(position) && relic.mainAttribute?.label !== "攻击加成") ||
    (position === 6 &&
      !["暴击", "暴击伤害"].includes(relic.mainAttribute?.label || ""))
  ) {
    return null;
  }

  return {
    relic,
    effectiveCount:
      getPveEffectiveSubAttributeCount(relic) + (isOutputOmaBonus ? 3 : 0),
    maximumEffectiveCount: isOutputOmaBonus ? 11 : 8,
  };
}

/** 首页与 PVE 页面共用的常用御魂评分汇总，评分规则保持单一来源。 */
export function getPveSuitScoreRanking(
  dataset: RelicDataset,
): PveSuitScoreSummary[] {
  const fourPieceSuitNames = new Set<string>();
  Object.values(dataset.relicsByPosition || {})
    .flat()
    .forEach((relic) => {
      const suit = relic.suit;
      if (!suit || relic.setBonusAttribute || suit.isTwoPieceSet) return;
      fourPieceSuitNames.add(suit.name);
    });

  const preferredFourPieceSuitNames = defaultFourPieceSuitNames.filter((name) =>
    fourPieceSuitNames.has(name),
  );
  const activeFourPieceSuitNames = preferredFourPieceSuitNames.length
    ? preferredFourPieceSuitNames
    : [...fourPieceSuitNames].slice(0, 7);
  const selectedSuitNames = new Set([
    ...activeFourPieceSuitNames,
    ...fixedOmaSuitNames,
  ]);
  const scores = new Map<string, PveSuitScoreSummary>();

  Object.values(dataset.relicsByPosition || {})
    .flat()
    .map(scorePveRelic)
    .filter((item): item is PveScoredRelic => Boolean(item))
    .filter((item) => selectedSuitNames.has(item.relic.suit?.name || ""))
    .filter((item) => item.effectiveCount >= 5)
    .forEach((item) => {
      const suitName = item.relic.suit?.name || "未知御魂";
      const current = scores.get(suitName) || {
        suitName,
        totalScore: 0,
        relicCount: 0,
        isOma: fixedOmaSuitNames.includes(suitName),
      };
      current.totalScore += item.effectiveCount;
      current.relicCount += 1;
      scores.set(suitName, current);
    });

  return [...activeFourPieceSuitNames, ...fixedOmaSuitNames].flatMap(
    (suitName) => {
      const score = scores.get(suitName);
      return score ? [score] : [];
    },
  );
}
