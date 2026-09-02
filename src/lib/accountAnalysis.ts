import type { AccountOverview, RelicDataset, RelicView } from "../types";

export type RelicStatKey =
  | "speed"
  | "critRate"
  | "critDamage"
  | "attackPercent"
  | "flatAttack"
  | "healthPercent"
  | "flatHealth"
  | "defensePercent"
  | "flatDefense"
  | "effectHit"
  | "effectResistance";

export type RelicEvidence = {
  relicId?: string;
  suitName: string;
  position: number;
  level: number;
  quality: number;
  mainAttribute?: string;
  value: number;
};

export type SellingPoint = {
  id: string;
  title: string;
  score: number;
  maxScore: number;
  value: number;
  unit: string;
  description: string;
  evidence: RelicEvidence[];
};

/**
 * 账号一速是六个固定号位的完整组合，不是某一件御魂的副属性速度。
 * value 仅包含御魂提供的速度，页面可按式神基础速度再计算最终面板。
 */
export type SpeedCombination = {
  value: number;
  relics: RelicEvidence[];
};

export type SuitSpeedCombinationOptions = {
  fourthMainAttribute?: string;
  sixthMainAttribute?: string;
  /** 多选主属性；未传或为空时不限制对应号位。 */
  fourthMainAttributes?: readonly string[];
  sixthMainAttributes?: readonly string[];
};

export type RelicInventoryAnalysis = {
  totalRelics: number;
  maxLevelRelics: number;
  effectiveRolls: number;
  effectiveRelics: number;
  bestSpeed: SpeedCombination | null;
  bestLuckySpeed: SpeedCombination | null;
  bestSpeedBySuit: Record<string, RelicEvidence>;
  speedSellerPoints: RelicEvidence[];
  fullSpeedRelics: RelicEvidence[];
};

export type AccountValueAnalysis = {
  totalScore: number;
  maxScore: number;
  sellingPoints: SellingPoint[];
  relics: RelicInventoryAnalysis;
};

/**
 * 账号卖点评分仅集中管理阈值与分值，页面不应自行拼接或改写这些规则。
 * 后续用藏宝阁对照样本校准时，只需调整此处的规则即可。
 */
export const accountScoringRules = {
  speed: [
    { min: 165, score: 30 },
    { min: 160, score: 26 },
    { min: 155, score: 22 },
    { min: 150, score: 18 },
    { min: 145, score: 14 },
  ],
  luckySpeed: [
    { min: 160, score: 24 },
    { min: 155, score: 20 },
    { min: 150, score: 16 },
    { min: 145, score: 12 },
  ],
  effectiveRolls: [
    { min: 420, score: 20 },
    { min: 320, score: 16 },
    { min: 240, score: 12 },
    { min: 160, score: 8 },
  ],
  pvpScore: [
    { min: 4200, score: 15 },
    { min: 3900, score: 13 },
    { min: 3600, score: 11 },
    { min: 3300, score: 9 },
    { min: 3000, score: 7 },
  ],
} as const;

const labels: Record<string, RelicStatKey> = {
  速度: "speed",
  暴击: "critRate",
  暴击伤害: "critDamage",
  攻击加成: "attackPercent",
  攻击: "flatAttack",
  生命加成: "healthPercent",
  生命: "flatHealth",
  防御加成: "defensePercent",
  防御: "flatDefense",
  效果命中: "effectHit",
  效果抵抗: "effectResistance",
};

const pveEffectiveStats = new Set<RelicStatKey>([
  "critRate",
  "critDamage",
  "attackPercent",
  "flatAttack",
]);

function statKeyFor(label: string) {
  return labels[label];
}

function allRelics(dataset: RelicDataset) {
  return Object.values(dataset.relicsByPosition || {}).flat();
}

function isFullyEnhancedSixStar(relic: RelicView) {
  return relic.quality === 6 && relic.level === 15;
}

function evidenceFor(relic: RelicView, value: number): RelicEvidence {
  return {
    relicId: relic.id,
    suitName: relic.suit?.name || "未知御魂",
    position: relic.position || 0,
    level: relic.level || 0,
    quality: relic.quality || 0,
    mainAttribute: relic.mainAttribute?.label,
    value,
  };
}

function relicSpeedContribution(relic: RelicView, includeMainSpeed = true) {
  const mainSpeed =
    includeMainSpeed && relic.mainAttribute?.label === "速度"
      ? relic.mainAttribute.value
      : 0;
  const subSpeed = getRelicSubAttributeTotals(relic).speed || 0;
  const singleSpeed =
    relic.setBonusAttribute?.label === "速度"
      ? relic.setBonusAttribute.value
      : 0;
  return mainSpeed + subSpeed + singleSpeed;
}

function bestRelicForSpeed(relics: RelicView[], includeMainSpeed = true) {
  return relics
    .map((relic) => ({
      relic,
      speed: relicSpeedContribution(relic, includeMainSpeed),
    }))
    .sort((left, right) => right.speed - left.speed)[0];
}

function speedCombinationFor(
  relicsByPosition: Record<string, RelicView[]>,
  requiredSuit?: string,
  includeMainSpeed = true,
  options: SuitSpeedCombinationOptions & {
    requireSecondPositionSpeed?: boolean;
  } = {},
): SpeedCombination | null {
  const allowedFourthMainAttributes = options.fourthMainAttributes?.length
    ? options.fourthMainAttributes
    : options.fourthMainAttribute
      ? [options.fourthMainAttribute]
      : undefined;
  const allowedSixthMainAttributes = options.sixthMainAttributes?.length
    ? options.sixthMainAttributes
    : options.sixthMainAttribute
      ? [options.sixthMainAttribute]
      : undefined;
  const positions = [1, 2, 3, 4, 5, 6];
  const positionCandidates = positions.map((position) =>
    (relicsByPosition[String(position)] || [])
      .filter(isFullyEnhancedSixStar)
      .filter(
        (relic) =>
          !options.requireSecondPositionSpeed ||
          position !== 2 ||
          relic.mainAttribute?.label === "速度",
      )
      .filter(
        (relic) =>
          !allowedFourthMainAttributes ||
          position !== 4 ||
          allowedFourthMainAttributes.includes(
            relic.mainAttribute?.label || "",
          ),
      )
      .filter(
        (relic) =>
          !allowedSixthMainAttributes ||
          position !== 6 ||
          allowedSixthMainAttributes.includes(relic.mainAttribute?.label || ""),
      ),
  );
  if (positionCandidates.some((items) => !items.length)) return null;

  // 无套装要求时，各个号位完全独立，直接取每个位置的速度最大值即为精确解。
  if (!requiredSuit) {
    const choices = positionCandidates.map((items) =>
      bestRelicForSpeed(items, includeMainSpeed),
    );
    if (choices.some((choice) => !choice)) return null;
    return {
      value: choices.reduce((total, choice) => total + (choice?.speed || 0), 0),
      relics: choices.map((choice) =>
        evidenceFor(choice!.relic, choice!.speed),
      ),
    };
  }

  // 四件套只需要在 6 个位置中选定 4 个。枚举 15 种位置分配后，
  // 每个位置仍独立取最优，因此不会因为候选裁剪而损失精度。
  let best: SpeedCombination | null = null;
  for (let mask = 0; mask < 1 << positions.length; mask += 1) {
    if (
      positions.filter((_, index) => Boolean(mask & (1 << index))).length !== 4
    )
      continue;
    const choices = positionCandidates.map((items, index) =>
      bestRelicForSpeed(
        mask & (1 << index)
          ? items.filter((relic) => relic.suit?.name === requiredSuit)
          : items,
        includeMainSpeed,
      ),
    );
    if (choices.some((choice) => !choice)) continue;
    const candidate: SpeedCombination = {
      value: choices.reduce((total, choice) => total + (choice?.speed || 0), 0),
      relics: choices.map((choice) =>
        evidenceFor(choice!.relic, choice!.speed),
      ),
    };
    if (!best || candidate.value > best.value) best = candidate;
  }
  return best;
}

export function getBestSpeedCombinationForSuit(
  dataset: RelicDataset,
  suitName: string,
  options: SuitSpeedCombinationOptions = {},
) {
  return speedCombinationFor(dataset.relicsByPosition, suitName, false, {
    ...options,
    requireSecondPositionSpeed: true,
  });
}

function scoreAt<T extends readonly { min: number; score: number }[]>(
  value: number,
  rules: T,
) {
  return rules.find((rule) => value >= rule.min)?.score || 0;
}

function maxScore<T extends readonly { score: number }[]>(rules: T) {
  return Math.max(...rules.map((rule) => rule.score));
}

/** 返回副属性的精确总值；优先使用 rattr 转换后的强化总值。 */
export function getRelicSubAttributeTotals(relic: RelicView) {
  const totals: Partial<Record<RelicStatKey, number>> = {};
  const preciseTotals = relic.enhancement?.totals;
  if (preciseTotals?.length) {
    preciseTotals.forEach((attribute) => {
      const key = statKeyFor(attribute.label);
      if (!key) return;
      totals[key] = (totals[key] || 0) + attribute.total;
    });
    return totals;
  }

  (relic.subAttributes || []).forEach((attribute) => {
    const key = statKeyFor(attribute.label);
    if (!key) return;
    totals[key] = (totals[key] || 0) + attribute.value;
  });
  return totals;
}

/** 返回副属性的有效强化次数，而非仅按“存在某条属性”计数。 */
export function getRelicEffectiveRollCount(relic: RelicView) {
  const preciseTotals = relic.enhancement?.totals;
  if (preciseTotals?.length) {
    return preciseTotals.reduce((count, attribute) => {
      const key = statKeyFor(attribute.label);
      return count + (key && pveEffectiveStats.has(key) ? attribute.count : 0);
    }, 0);
  }

  return (relic.subAttributes || []).filter((attribute) => {
    const key = statKeyFor(attribute.label);
    return key && pveEffectiveStats.has(key);
  }).length;
}

/**
 * 满速不在商品 highlights 中，按原始 rattr 内速度条目总数为 6 的
 * 满级6星 御魂统计；二号位仅主速度可计入。
 */
export function getFullSpeedRelics(dataset: RelicDataset) {
  return allRelics(dataset)
    .filter(isFullyEnhancedSixStar)
    .map((relic) => {
      const speed = getRelicSubAttributeTotals(relic).speed || 0;
      const totalCount =
        relic.enhancement?.totals?.find(
          (attribute) => attribute.label === "速度",
        )?.count || 0;
      return { relic, speed, totalCount };
    })
    .filter(
      ({ relic, totalCount }) =>
        totalCount === 6 &&
        (relic.position !== 2 || relic.mainAttribute?.label === "速度"),
    )
    .map(({ relic, speed }) => evidenceFor(relic, speed));
}

export function analyzeRelicInventory(
  dataset: RelicDataset,
): RelicInventoryAnalysis {
  const relics = allRelics(dataset);
  const eligibleRelics = relics.filter(isFullyEnhancedSixStar);
  const bestSpeedBySuit = new Map<string, RelicEvidence>();
  const speedCandidates: RelicEvidence[] = [];
  const fullSpeedRelics = getFullSpeedRelics(dataset);
  let effectiveRolls = 0;
  let effectiveRelics = 0;

  eligibleRelics.forEach((relic) => {
    const totals = getRelicSubAttributeTotals(relic);
    const speed = totals.speed || 0;
    const rollCount = getRelicEffectiveRollCount(relic);
    effectiveRolls += rollCount;
    if (rollCount > 0) effectiveRelics += 1;
    if (speed <= 0) return;

    const evidence = evidenceFor(relic, speed);
    speedCandidates.push(evidence);
    const previous = bestSpeedBySuit.get(evidence.suitName);
    if (!previous || evidence.value > previous.value)
      bestSpeedBySuit.set(evidence.suitName, evidence);
  });

  const orderedSpeedCandidates = [...speedCandidates].sort(
    (left, right) => right.value - left.value,
  );
  const bestSpeed = speedCombinationFor(dataset.relicsByPosition);
  const bestLuckySpeed = speedCombinationFor(
    dataset.relicsByPosition,
    "招财猫",
  );
  const speedSellerPoints = orderedSpeedCandidates.filter((item) => {
    const isSecondPositionSpeed =
      item.position === 2 && item.mainAttribute === "速度";
    return item.value > 17 && (item.position !== 2 || isSecondPositionSpeed);
  });

  return {
    totalRelics: relics.length,
    maxLevelRelics: eligibleRelics.length,
    effectiveRolls,
    effectiveRelics,
    bestSpeed,
    bestLuckySpeed,
    bestSpeedBySuit: Object.fromEntries(bestSpeedBySuit),
    speedSellerPoints,
    fullSpeedRelics,
  };
}

function createSellingPoint(
  id: string,
  title: string,
  value: number,
  unit: string,
  score: number,
  max: number,
  description: string,
  evidence: RelicEvidence[] = [],
): SellingPoint {
  return {
    id,
    title,
    value,
    unit,
    score,
    maxScore: max,
    description,
    evidence,
  };
}

/**
 * 账号卖点评分输出各维度和证据，不将原始藏宝阁数据或御魂明细丢失。
 * 页面可直接展示 sellingPoints，也可按业务需要使用 totalScore 排序。
 */
export function analyzeAccountValue(
  dataset: RelicDataset,
): AccountValueAnalysis {
  const account: AccountOverview = dataset.account || {};
  const relics = analyzeRelicInventory(dataset);
  const speedValue = account.scatteredFirstSpeed || 0;
  const luckySpeedValue = account.luckyFirstSpeed || 0;
  const pvpValue = account.pvpScore || 0;
  const sellingPoints = [
    createSellingPoint(
      "speed",
      "御魂一速",
      speedValue,
      "",
      scoreAt(speedValue, accountScoringRules.speed),
      maxScore(accountScoringRules.speed),
      "直接使用藏宝阁商品 highlights 返回的散件一速。",
    ),
    createSellingPoint(
      "luckySpeed",
      "招财一速",
      luckySpeedValue,
      "",
      scoreAt(luckySpeedValue, accountScoringRules.luckySpeed),
      maxScore(accountScoringRules.luckySpeed),
      "直接使用藏宝阁商品 highlights 返回的招财一速。",
    ),
    createSellingPoint(
      "pveEffectiveRolls",
      "PVE 有效强化",
      relics.effectiveRolls,
      "次",
      scoreAt(relics.effectiveRolls, accountScoringRules.effectiveRolls),
      maxScore(accountScoringRules.effectiveRolls),
      "统计暴击、暴击伤害、攻击加成与攻击的副属性强化次数。",
    ),
    createSellingPoint(
      "pvp",
      "斗技",
      pvpValue,
      "分",
      scoreAt(pvpValue, accountScoringRules.pvpScore),
      maxScore(accountScoringRules.pvpScore),
      "按藏宝阁展示的斗技分进行分段评分。",
    ),
  ];
  return {
    totalScore: sellingPoints.reduce((total, item) => total + item.score, 0),
    maxScore: sellingPoints.reduce((total, item) => total + item.maxScore, 0),
    sellingPoints,
    relics,
  };
}
