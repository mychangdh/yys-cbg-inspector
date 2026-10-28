import type { DatasetHistoryRecord } from "@/store";
import { getFullSpeedRelics } from "./accountAnalysis";

export type AccountMatcherCriteria = {
  minimumPrice: number | null;
  maximumPrice: number | null;
  selectedServers: string[];
  publication: "any" | "only" | "exclude";
  platforms: string[];
  priority: "balanced" | "price" | "speed";
  dexRequirements: string[];
  numberFilters: Record<string, number | null>;
  assetFlags: string[];
  skinNames: string[];
  avatarFrames: string[];
  goldenAvatarFrame: boolean;
  badges: string[];
  achievements: string[];
};

export type AccountMatchEvidence = {
  label: string;
  expected: string;
  actual: string;
  status: "match" | "near" | "unknown";
};

export type AccountMatchResult = {
  record: DatasetHistoryRecord;
  score: number | null;
  matchedCount: number;
  evaluatedCount: number;
  unknownCount: number;
  differences: AccountMatchEvidence[];
  unavailable: AccountMatchEvidence[];
};

type MatchDimension = "price" | "speed" | "other";
type ScoredEvidence = AccountMatchEvidence & {
  value: number;
  dimension: MatchDimension;
};

function finiteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function displayNumber(value: number) {
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function addUnknown(
  evidence: ScoredEvidence[],
  label: string,
  expected: string,
) {
  evidence.push({
    label,
    expected,
    actual: "本地数据未保存",
    status: "unknown",
    value: 0,
    dimension: "other",
  });
}

function addKnown(
  evidence: ScoredEvidence[],
  label: string,
  expected: string,
  actual: string,
  value: number,
  dimension: MatchDimension,
) {
  evidence.push({
    label,
    expected,
    actual,
    status: value >= 1 ? "match" : "near",
    value: clamp(value),
    dimension,
  });
}

function addMinimum(
  evidence: ScoredEvidence[],
  label: string,
  required: number | null | undefined,
  actualValue: unknown,
  dimension: MatchDimension,
) {
  if (required === null || required === undefined || required <= 0) return;
  const actual = finiteNumber(actualValue);
  const expected = `≥ ${displayNumber(required)}`;
  if (actual === undefined) {
    addUnknown(evidence, label, expected);
    return;
  }
  addKnown(
    evidence,
    label,
    expected,
    displayNumber(actual),
    actual >= required ? 1 : actual / required,
    dimension,
  );
}

function addMaximum(
  evidence: ScoredEvidence[],
  label: string,
  maximum: number | null | undefined,
  actualValue: unknown,
) {
  if (maximum === null || maximum === undefined) return;
  const actual = finiteNumber(actualValue);
  const expected = `≤ ${displayNumber(maximum)}`;
  if (actual === undefined) {
    addUnknown(evidence, label, expected);
    return;
  }
  addKnown(
    evidence,
    label,
    expected,
    displayNumber(actual),
    actual <= maximum ? 1 : actual === 0 ? 0 : maximum / actual,
    "other",
  );
}

function addRange(
  evidence: ScoredEvidence[],
  minimum: number | null,
  maximum: number | null,
  actualValue: unknown,
) {
  if (minimum === null && maximum === null) return;
  const actual = finiteNumber(actualValue);
  const expected =
    minimum !== null && maximum !== null
      ? `¥${displayNumber(minimum)}–¥${displayNumber(maximum)}`
      : minimum !== null
        ? `≥ ¥${displayNumber(minimum)}`
        : `≤ ¥${displayNumber(maximum!)}`;
  if (actual === undefined) {
    addUnknown(evidence, "预算", expected);
    return;
  }
  const belowMinimum = minimum !== null && actual < minimum;
  const aboveMaximum = maximum !== null && actual > maximum;
  const closeness = belowMinimum
    ? minimum > 0
      ? actual / minimum
      : 0
    : aboveMaximum
      ? actual > 0
        ? maximum! / actual
        : 0
      : 1;
  addKnown(
    evidence,
    "预算",
    expected,
    `¥${displayNumber(actual)}`,
    closeness,
    "price",
  );
}

function addChoice(
  evidence: ScoredEvidence[],
  label: string,
  expected: string,
  actual: string | undefined,
  matches: (actual: string) => boolean,
  dimension: MatchDimension = "other",
) {
  if (!actual) {
    addUnknown(evidence, label, expected);
    return;
  }
  addKnown(
    evidence,
    label,
    expected,
    actual,
    matches(actual) ? 1 : 0,
    dimension,
  );
}

function normalizedServerName(value: string) {
  return value
    .trim()
    .replace(/[\s\-_]/g, "")
    .toLocaleLowerCase();
}

function selectedServerMatches(actual: string, selected: string[]) {
  const server = normalizedServerName(actual.split("/").at(-1) || actual);
  return selected.some((item) => {
    const selectedName = normalizedServerName(item.split("/").at(-1) || item);
    return server === selectedName || server.endsWith(selectedName);
  });
}

function addMinimumFromFilter(
  evidence: ScoredEvidence[],
  criteria: AccountMatcherCriteria,
  key: string,
  label: string,
  actual: unknown,
  dimension: MatchDimension,
) {
  addMinimum(evidence, label, criteria.numberFilters[key], actual, dimension);
}

function assessRecord(
  record: DatasetHistoryRecord,
  criteria: AccountMatcherCriteria,
): AccountMatchResult {
  const evidence: ScoredEvidence[] = [];
  const { account, heroes, relicsByPosition } = record.dataset;
  const relicInventoryAvailable =
    relicsByPosition && Object.keys(relicsByPosition).length > 0;
  const fullSpeedRelics = relicInventoryAvailable
    ? getFullSpeedRelics(record.dataset)
    : undefined;

  if (criteria.selectedServers.length) {
    addChoice(
      evidence,
      "区服",
      criteria.selectedServers
        .map((server) => server.split("/").at(-1) || server)
        .join("、"),
      account?.serverName,
      (actual) => selectedServerMatches(actual, criteria.selectedServers),
    );
  }

  if (criteria.publication !== "any") {
    addChoice(
      evidence,
      "公示期",
      criteria.publication === "only" ? "只看公示期" : "不看公示期",
      account?.listingStatus,
      (actual) =>
        criteria.publication === "only"
          ? actual === "公示期"
          : actual !== "公示期",
    );
  }

  if (criteria.platforms.length) {
    addUnknown(evidence, "操作系统", criteria.platforms.join(" / "));
  }

  addRange(
    evidence,
    criteria.minimumPrice,
    criteria.maximumPrice,
    account?.price,
  );

  const dexKeys: Record<string, "ssr" | "sp" | "ur"> = {
    ssr: "ssr",
    sp: "sp",
    ur: "ur",
  };
  criteria.dexRequirements.forEach((requirement) => {
    if (requirement === "collaboration") {
      addUnknown(evidence, "联动全图鉴", "全图鉴");
      return;
    }
    const key = dexKeys[requirement];
    if (!key) return;
    const dex = account?.shikigamiDex?.[key];
    if (!dex || dex.total <= 0) {
      addUnknown(evidence, `${requirement.toUpperCase()} 全图鉴`, "全图鉴");
      return;
    }
    addKnown(
      evidence,
      `${requirement.toUpperCase()} 全图鉴`,
      "全图鉴",
      `${dex.owned}/${dex.total}`,
      dex.owned / dex.total,
      "other",
    );
  });

  if (
    criteria.numberFilters.minimumSixStarHeroCount !== null &&
    criteria.numberFilters.minimumSixStarHeroCount !== undefined
  ) {
    const sixStarCount = heroes?.filter((hero) => hero.rarity >= 6).length;
    addMinimumFromFilter(
      evidence,
      criteria,
      "minimumSixStarHeroCount",
      "6 星式神数量",
      sixStarCount,
      "other",
    );
  }

  addMinimumFromFilter(
    evidence,
    criteria,
    "minimumStyle",
    "风姿度",
    account?.fengzidu,
    "other",
  );
  addMinimumFromFilter(
    evidence,
    criteria,
    "minimumSignInDays",
    "签到天数",
    undefined,
    "other",
  );
  addMaximum(
    evidence,
    "等级",
    criteria.numberFilters.maximumLevel,
    account?.level,
  );

  addMinimumFromFilter(
    evidence,
    criteria,
    "minimumMaxSpeedCount",
    "满速御魂数",
    fullSpeedRelics?.length,
    "speed",
  );
  addMinimumFromFilter(
    evidence,
    criteria,
    "minimumScatteredSpeed",
    "散件一速",
    account?.scatteredFirstSpeed,
    "speed",
  );
  addMinimumFromFilter(
    evidence,
    criteria,
    "minimumLuckySpeed",
    "招财一速",
    account?.luckyFirstSpeed,
    "speed",
  );
  addMinimumFromFilter(
    evidence,
    criteria,
    "minimumHeadCount",
    "头个数",
    account?.speedHeadCount,
    "speed",
  );
  addMinimumFromFilter(
    evidence,
    criteria,
    "minimumHeadSpeed",
    "头速度",
    undefined,
    "speed",
  );
  addMinimumFromFilter(
    evidence,
    criteria,
    "minimumTailCount",
    "尾个数",
    account?.speedTailCount,
    "speed",
  );
  addMinimumFromFilter(
    evidence,
    criteria,
    "minimumTailSpeed",
    "尾速度",
    undefined,
    "speed",
  );
  addMinimumFromFilter(
    evidence,
    criteria,
    "minimumLuckyHeadCount",
    "招财头个数",
    undefined,
    "speed",
  );
  addMinimumFromFilter(
    evidence,
    criteria,
    "minimumLuckyHeadSpeed",
    "招财头速度",
    undefined,
    "speed",
  );

  const assets: Record<string, { label: string; value: unknown }> = {
    jade: { label: "勾玉", value: account?.soulJade },
    mysteryAmulet: { label: "神秘符咒", value: account?.mysteryTalisman },
    stamina: { label: "体力", value: account?.stamina },
    goldWan: {
      label: "金币（万）",
      value:
        finiteNumber(account?.money) === undefined
          ? undefined
          : finiteNumber(account?.money)! / 10_000,
    },
    goldenAmulet: { label: "金御札", value: undefined },
    jadeStone: { label: "魂玉", value: undefined },
    御札: { label: "御札", value: undefined },
    逢魔之魂: { label: "逢魔之魂", value: undefined },
    大蛇的逆鳞: { label: "大蛇的逆鳞", value: undefined },
    御行达摩: { label: "御行达摩", value: account?.yuxingDama },
    皮肤券: { label: "皮肤券", value: undefined },
    勋章: { label: "勋章", value: undefined },
    六星结界卡: { label: "六星结界卡", value: undefined },
    满级御魂: { label: "满级御魂", value: account?.maxLevelRelicCount },
  };
  Object.entries(assets).forEach(([key, item]) => {
    addMinimumFromFilter(
      evidence,
      criteria,
      key,
      item.label,
      item.value,
      "other",
    );
  });

  addMinimumFromFilter(
    evidence,
    criteria,
    "式神皮肤总数",
    "式神皮肤总数",
    undefined,
    "other",
  );
  addMinimumFromFilter(
    evidence,
    criteria,
    "典藏皮肤总数",
    "典藏皮肤总数",
    account?.collectionSkinCount,
    "other",
  );
  [
    "庭院皮肤总数",
    "召唤屋皮肤总数",
    "幕间皮肤总数",
    "战斗主题总数",
    "阴阳术皮肤总数",
  ].forEach((key) =>
    addMinimumFromFilter(evidence, criteria, key, key, undefined, "other"),
  );

  criteria.assetFlags.forEach((flag) => addUnknown(evidence, flag, "已开启"));
  criteria.skinNames.forEach((skin) => addUnknown(evidence, "指定皮肤", skin));
  criteria.avatarFrames.forEach((frame) =>
    addUnknown(evidence, "头像框", frame),
  );
  if (criteria.goldenAvatarFrame) {
    addUnknown(evidence, "京都之主（金达摩）", "拥有");
  }
  criteria.badges.forEach((badge) => addUnknown(evidence, "徽章", badge));
  criteria.achievements.forEach((achievement) =>
    addUnknown(evidence, "成就", achievement),
  );

  const scoredEvidence = evidence.filter((item) => item.status !== "unknown");
  const weightedTotal = scoredEvidence.reduce((total, item) => {
    const weight = criteria.priority === item.dimension ? 3 : 1;
    return total + item.value * weight;
  }, 0);
  const totalWeight = scoredEvidence.reduce(
    (total, item) => total + (criteria.priority === item.dimension ? 3 : 1),
    0,
  );

  return {
    record,
    score: totalWeight ? Math.round((weightedTotal / totalWeight) * 100) : null,
    matchedCount: scoredEvidence.filter((item) => item.status === "match")
      .length,
    evaluatedCount: scoredEvidence.length,
    unknownCount: evidence.length - scoredEvidence.length,
    differences: evidence.filter((item) => item.status === "near"),
    unavailable: evidence.filter((item) => item.status === "unknown"),
  };
}

export function matchAccountHistory(
  history: DatasetHistoryRecord[],
  criteria: AccountMatcherCriteria,
) {
  return history
    .map((record) => assessRecord(record, criteria))
    .sort((left, right) => {
      if (left.score !== right.score) {
        return (right.score ?? -1) - (left.score ?? -1);
      }
      if (left.matchedCount !== right.matchedCount) {
        return right.matchedCount - left.matchedCount;
      }

      const leftAccount = left.record.dataset.account;
      const rightAccount = right.record.dataset.account;
      if (criteria.priority === "speed") {
        const leftSpeed =
          (finiteNumber(leftAccount?.scatteredFirstSpeed) ?? 0) +
          (finiteNumber(leftAccount?.luckyFirstSpeed) ?? 0);
        const rightSpeed =
          (finiteNumber(rightAccount?.scatteredFirstSpeed) ?? 0) +
          (finiteNumber(rightAccount?.luckyFirstSpeed) ?? 0);
        if (leftSpeed !== rightSpeed) return rightSpeed - leftSpeed;
      }
      if (criteria.priority === "price") {
        const leftPrice = finiteNumber(leftAccount?.price) ?? Infinity;
        const rightPrice = finiteNumber(rightAccount?.price) ?? Infinity;
        if (leftPrice !== rightPrice) return leftPrice - rightPrice;
      }
      return right.record.savedAt - left.record.savedAt;
    });
}
