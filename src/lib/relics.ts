import type {
  AttributeView,
  RelicSuitConfig,
  GrowthRoll,
  HeroView,
  RelicDataset,
  RelicView,
  StageAttribute,
  EnhancementStage,
} from "../types";

type UnknownRecord = Record<string, unknown>;

type CbgEquip = UnknownRecord & {
  equip_desc?: unknown;
  equip_name?: unknown;
  format_equip_name?: unknown;
  server_name?: unknown;
  highlights?: unknown;
  collect_num?: unknown;
};

type CbgPayload = UnknownRecord & {
  equip?: CbgEquip;
  equip_data?: CbgEquip;
};

type CbgDetail = UnknownRecord & {
  hero_history?: UnknownRecord;
  heroes?: UnknownRecord;
  inventory?: UnknownRecord;
  damo_count_dict?: UnknownRecord;
};

type EnhancementGroup = {
  key: string;
  label: string;
  count: number;
  total: number;
};

const growthMax: Record<string, number> = {
  speedAdditionVal: 3,
  critRateAdditionVal: 3,
  critPowerAdditionVal: 4,
  attackAdditionRate: 3,
  attackAdditionVal: 27,
  maxHpAdditionRate: 3,
  maxHpAdditionVal: 114,
  defenseAdditionRate: 3,
  defenseAdditionVal: 5,
  debuffEnhance: 4,
  debuffResist: 4,
};

const sixStarMainAttributeRanges: Record<
  string,
  { initial: number; maximum: number }
> = {
  攻击: { initial: 65, maximum: 486 },
  防御: { initial: 14, maximum: 104 },
  生命: { initial: 274, maximum: 2052 },
  速度: { initial: 12, maximum: 57 },
  攻击加成: { initial: 10, maximum: 55 },
  防御加成: { initial: 10, maximum: 55 },
  生命加成: { initial: 10, maximum: 55 },
  暴击: { initial: 10, maximum: 55 },
  暴击伤害: { initial: 14, maximum: 89 },
  效果命中: { initial: 10, maximum: 55 },
  效果抵抗: { initial: 10, maximum: 55 },
};

const rollLabels: Record<string, string> = {
  speedAdditionVal: "速度",
  critRateAdditionVal: "暴击",
  critPowerAdditionVal: "暴击伤害",
  attackAdditionRate: "攻击加成",
  attackAdditionVal: "攻击",
  maxHpAdditionRate: "生命加成",
  maxHpAdditionVal: "生命",
  defenseAdditionRate: "防御加成",
  defenseAdditionVal: "防御",
  debuffEnhance: "效果命中",
  debuffResist: "效果抵抗",
};

export const variableMainPositions = new Set([2, 4, 6]);
export const fixedMainAttributesByPosition: Record<number, string> = {
  1: "攻击",
  3: "防御",
  5: "生命",
};

const attributeDisplayOrder = [
  "速度",
  "暴击",
  "暴击伤害",
  "效果命中",
  "效果抵抗",
  "生命加成",
  "攻击加成",
  "防御加成",
  "攻击",
  "生命",
  "防御",
];
const attributeDisplayOrderMap = new Map(
  attributeDisplayOrder.map((label, index) => [label, index]),
);

export const subAttributeSortOptions = attributeDisplayOrder.map((value) => ({
  label: `副属性：${value}`,
  value,
}));

export function compareAttributeLabels(left: string, right: string) {
  const leftOrder = attributeDisplayOrderMap.get(left);
  const rightOrder = attributeDisplayOrderMap.get(right);
  if (leftOrder !== undefined || rightOrder !== undefined)
    return (
      (leftOrder ?? Number.MAX_SAFE_INTEGER) -
      (rightOrder ?? Number.MAX_SAFE_INTEGER)
    );
  return left.localeCompare(right, "zh-CN");
}

export function sortAttributes<T extends { label: string }>(attributes: T[]) {
  return [...attributes].sort((left, right) =>
    compareAttributeLabels(left.label, right.label),
  );
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asCbgPayload(payload: unknown): CbgPayload {
  return isRecord(payload) ? (payload as CbgPayload) : {};
}

function parseAttributeTuple(value: unknown): [string, string] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  return [String(value[0] ?? ""), String(value[1] ?? "")];
}

function numberOrUndefined(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : undefined;
}

function normalizeAttribute(
  attribute: readonly [string, string],
): AttributeView {
  const display = String(attribute?.[1] || "0");
  return {
    label: String(attribute?.[0] || "未知属性"),
    value: Number.parseFloat(display.replace("%", "")) || 0,
    isPercent: display.includes("%"),
  };
}

function mainAttributeAtLevel(
  mainAttribute: RelicView["mainAttribute"],
  quality: number,
  level: number,
  actualLevel: number,
) {
  if (!mainAttribute) return null;
  const range =
    Number(quality) === 6
      ? sixStarMainAttributeRanges[mainAttribute.label]
      : undefined;
  if (range) {
    const stageLevel = Math.max(0, Math.min(15, Number(level) || 0));
    return {
      ...mainAttribute,
      value:
        range.initial + ((range.maximum - range.initial) * stageLevel) / 15,
    };
  }
  return Number(level) === Number(actualLevel) ? { ...mainAttribute } : null;
}

export function buildEnhancementStages(
  rolls: GrowthRoll[] = [],
  level = 0,
  mainAttribute: RelicView["mainAttribute"] = null,
  quality = 6,
) {
  const enhancementCount = Math.max(0, Math.floor((Number(level) || 0) / 3));
  const initialRollCount = Math.max(0, rolls.length - enhancementCount);
  const attributes = new Map<string, StageAttribute>();
  const applyRoll = (roll: GrowthRoll) => {
    const current = attributes.get(roll.key) || {
      key: roll.key,
      label: roll.label,
      value: 0,
      values: [],
    };
    current.value += roll.increase;
    current.values.push(roll.increase);
    attributes.set(roll.key, current);
  };
  const snapshot = () =>
    sortAttributes([...attributes.values()]).map((attribute) => ({
      ...attribute,
      values: [...attribute.values],
    }));

  rolls.slice(0, initialRollCount).forEach(applyRoll);
  const stages: EnhancementStage[] = [
    {
      level: 0,
      available: true,
      upgrade: null,
      mainAttribute: mainAttributeAtLevel(mainAttribute, quality, 0, level),
      attributes: snapshot(),
    },
  ];
  for (let index = 0; index < 5; index += 1) {
    const available = index < enhancementCount;
    const roll = available ? rolls[initialRollCount + index] : undefined;
    const isNew = Boolean(roll && !attributes.has(roll.key));
    if (roll) applyRoll(roll);
    stages.push({
      level: (index + 1) * 3,
      available,
      upgrade: roll
        ? {
            key: roll.key,
            label: roll.label,
            increase: roll.increase,
            isNew,
          }
        : null,
      mainAttribute: mainAttributeAtLevel(
        mainAttribute,
        quality,
        (index + 1) * 3,
        level,
      ),
      attributes: snapshot(),
    });
  }
  return { initialRollCount, enhancementCount, enhancementStages: stages };
}

export function parseProductUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("请输入有效的藏宝阁商品链接");
  }
  if (!["yys.cbg.163.com", "cbg.163.com"].includes(url.hostname.toLowerCase()))
    throw new Error("仅支持阴阳师藏宝阁商品链接");
  const match = url.pathname.match(/\/equip\/(\d+)\/([^/]+)/i);
  if (!match) throw new Error("链接中没有找到服务器和商品编号");
  url.protocol = "https:";
  return { serverid: match[1], ordersn: match[2], sourceUrl: url.toString() };
}

function parseHighlightNumber(highlights: unknown, label: string) {
  const text = Array.isArray(highlights)
    ? highlights.join(" ")
    : String(highlights || "");
  const match = text.match(new RegExp(`${label}\\s*([0-9]+(?:\\.[0-9]+)?)`));
  return match ? Number(match[1]) : undefined;
}

function parseSpeedHighlights(highlights: unknown) {
  const text = Array.isArray(highlights)
    ? highlights.join(" ")
    : String(highlights || "");
  const countMatch = text.match(/(\d+)\s*头\s*(\d+)\s*尾/);
  return {
    scatteredFirstSpeed: parseHighlightNumber(text, "散件一速"),
    luckyFirstSpeed: parseHighlightNumber(text, "招财一速"),
    speedHeadCount: countMatch ? Number(countMatch[1]) : undefined,
    speedTailCount: countMatch ? Number(countMatch[2]) : undefined,
  };
}

/** 从商品原始 highlights 提取藏宝阁已计算的一速与头尾汇总。 */
export function extractCbgSpeedHighlights(payload: unknown) {
  const source = asCbgPayload(payload);
  const equip = source.equip;
  const equipData = source.equip_data;
  return parseSpeedHighlights(equip?.highlights ?? equipData?.highlights);
}

/** 藏宝阁商品详情直接提供典藏皮肤数量。 */
export function extractCbgCollectionSkinCount(payload: unknown) {
  const source = asCbgPayload(payload);
  const equip = source.equip || source.equip_data;
  const count = Number(equip?.collect_num);
  return Number.isFinite(count) ? count : undefined;
}

export function convertCbgPayloadToDataset(
  payload: unknown,
  relicSuitConfig: RelicSuitConfig,
  options: { includeEnhancementStages?: boolean } = {},
): RelicDataset {
  const source = asCbgPayload(payload);
  const equip = source.equip || source.equip_data;
  const equipDescription = equip?.equip_desc;
  if (!equipDescription) throw new Error("商品接口没有返回御魂数据");
  const parsedDetail =
    typeof equipDescription === "string"
      ? JSON.parse(equipDescription)
      : equipDescription;
  if (!isRecord(parsedDetail))
    throw new Error("商品接口返回的御魂数据格式无效");
  const detail = parsedDetail as CbgDetail;
  const twoPieceSets = relicSuitConfig.two_suit_yuhun ?? {};
  const speedHighlights = extractCbgSpeedHighlights(payload);
  const currency = (id: string) => Number(detail[id]) || 0;
  const heroHistory: UnknownRecord = isRecord(detail.hero_history)
    ? detail.hero_history
    : {};
  const getDexCount = (key: string) => {
    const history = isRecord(heroHistory[key]) ? heroHistory[key] : {};
    return {
      owned: Number(history.got) || 0,
      total: Number(history.all) || 0,
    };
  };
  const getOptionalFlag = (key: string) =>
    detail[key] === undefined ? null : Number(detail[key]) || 0;
  const soulJade = Number(detail.goyu ?? detail.soul_jade) || 0;
  // 御行达摩不是 currency 字段，藏宝阁会按来源放在 damo_count_dict 中；物品 ID 411 为御行达摩。
  const damoCountDict = isRecord(detail.damo_count_dict)
    ? Object.values(detail.damo_count_dict).filter(isRecord)
    : [];
  const yuxingDama = damoCountDict.reduce(
    (total, counts) => total + (Number(counts["411"]) || 0),
    0,
  );
  // 只有这些明确字段代表召唤券。900215 在游戏中还可能表示八岐大蛇鳞片等其他资源。
  const mysteryTalisman = Number(detail.gameble_card) || 0;
  const realityTalisman = Number(detail.ar_gamble_card) || 0;
  const summonPower =
    Math.floor(soulJade / 1000) * 11 +
    Math.floor((soulJade % 1000) / 100) +
    mysteryTalisman +
    realityTalisman;
  const spiritIds = new Set([
    900, 901, 902, 903, 904, 905, 906, 907, 908, 909, 910,
  ]);
  const heroRecords = isRecord(detail.heroes)
    ? Object.values(detail.heroes).filter(isRecord)
    : [];
  const heroes: HeroView[] = heroRecords
    .map((raw) => {
      // 藏宝阁不同批次的数据会把等级返回为 level、lv 或字符串。
      // 统一在转换层解析，避免页面把有效等级降级成 0。
      const heroLevel = Number(
        raw.level ?? raw.lv ?? raw.heroLevel ?? raw.hero_level,
      );
      const skillEntries: unknown[] = Array.isArray(raw.skinfo)
        ? raw.skinfo
        : [];
      const levelsBySkillId = new Map<number, number>(
        skillEntries.flatMap((item): Array<[number, number]> => {
          if (!Array.isArray(item) || item.length < 2) return [];
          return [[Number(item[0]) || 0, Number(item[1]) || 0]];
        }),
      );
      const selectedSkills: unknown[] = Array.isArray(raw.selectSkills)
        ? raw.selectSkills
        : [];
      const skillLevels = selectedSkills
        .map((skillId: unknown) => levelsBySkillId.get(Number(skillId)) || 0)
        .filter((level: number) => level > 0);

      return {
        instanceId: String(raw.heroUid || raw.uid || raw.heroId || ""),
        heroId: Number(raw.heroId) || 0,
        name: String(raw.name || "未知式神"),
        rarity: Number(raw.rarity) || 0,
        level: Number.isFinite(heroLevel) ? heroLevel : 0,
        skillLevels: (skillLevels.length
          ? skillLevels
          : skillEntries.map((item) =>
              Array.isArray(item) ? Number(item[1]) || 0 : 0,
            )
        ).slice(0, 3),
      };
    })
    .filter(
      (hero: HeroView) =>
        hero.heroId > 0 &&
        hero.heroId < 900 &&
        !spiritIds.has(hero.heroId) &&
        hero.skillLevels.length > 0,
    );
  const relicRecords = isRecord(detail.inventory)
    ? Object.values(detail.inventory).filter(isRecord)
    : [];
  const relics: RelicView[] = relicRecords.map((raw) => {
    const groups = new Map<string, EnhancementGroup>();
    const growthRolls: GrowthRoll[] = [];
    const growthEntries: unknown[] = Array.isArray(raw.rattr) ? raw.rattr : [];
    for (const entry of growthEntries) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const key = String(entry[0] ?? "");
      const coefficient = Number(entry[1]) || 0;
      const value = (growthMax[key] || 0) * coefficient;
      const group = groups.get(key) || {
        key,
        label: rollLabels[key] || key,
        count: 0,
        total: 0,
      };
      group.count += 1;
      group.total += value;
      groups.set(key, group);
      growthRolls.push({
        key,
        label: rollLabels[key] || key,
        increase: value,
      });
    }
    const attributeEntries: unknown[] = Array.isArray(raw.attrs)
      ? raw.attrs
      : [];
    const attributes = attributeEntries.flatMap((attribute) => {
      const tuple = parseAttributeTuple(attribute);
      return tuple ? [normalizeAttribute(tuple)] : [];
    });
    const setBonusAttribute = raw.single_attr
      ? parseAttributeTuple(raw.single_attr)
      : null;
    return {
      id: String(raw.uuid || ""),
      level: Number(raw.level) || 0,
      quality: Number(raw.qua) || 0,
      position: Number(raw.pos) || 0,
      suit: {
        id: Number(raw.suitid) || 0,
        name: String(raw.name || "未知御魂"),
        isTwoPieceSet: Boolean(twoPieceSets[String(raw.suitid)]),
      },
      mainAttribute: attributes[0] || null,
      subAttributes: attributes.slice(1),
      setBonusAttribute: setBonusAttribute
        ? normalizeAttribute(setBonusAttribute)
        : null,
      enhancement: { totals: [...groups.values()] },
      detail: {
        growthRolls,
        ...(options.includeEnhancementStages === false
          ? {}
          : buildEnhancementStages(
              growthRolls,
              Number(raw.level) || 0,
              attributes[0] || null,
              Number(raw.qua) || 0,
            )),
      },
    };
  });
  const pvpStage =
    typeof detail.pvp_stage === "string" || typeof detail.pvp_stage === "number"
      ? detail.pvp_stage
      : undefined;
  return {
    schemaVersion: 11,
    account: {
      title: String(
        equip.equip_name || equip.format_equip_name || "藏宝阁商品",
      ),
      name: stringOrUndefined(detail.name),
      serverName:
        stringOrUndefined(equip.server_name) ||
        stringOrUndefined(detail.origin_server_name),
      level: numberOrUndefined(detail.lv),
      fengzidu: numberOrUndefined(detail.fengzidu),
      pvpScore: numberOrUndefined(detail.pvp_score),
      pvpStage,
      ...speedHighlights,
      relicSummary: numberOrUndefined(detail.equips_summary),
      heroSummary: numberOrUndefined(detail.hero_summary),
      collectionSkinCount: extractCbgCollectionSkinCount(payload),
      yuxingDama,
      money: numberOrUndefined(detail.money),
      stamina:
        numberOrUndefined(detail.strength) || currency("currency_900273"),
      maxLevelRelicCount: numberOrUndefined(detail.level_15),
      soulJade,
      mysteryTalisman,
      realityTalisman,
      summonPower,
      shikigamiDex: {
        ssr: getDexCount("ssr"),
        sp: getDexCount("sp"),
        ur: getDexCount("ur"),
        uncollected500Days: getOptionalFlag("ssr_coin"),
        uncollected999Days: getOptionalFlag("sp_coin"),
        uncollectedCoupon: currency("currency_490017"),
      },
    },
    heroes,
    relicsByPosition: Object.fromEntries(
      [1, 2, 3, 4, 5, 6].map((position) => [
        String(position),
        relics.filter((relic) => relic.position === position),
      ]),
    ),
  };
}

export function formatAttribute(attribute: AttributeView) {
  return `${attribute.value.toFixed(2)}${attribute.isPercent ? "%" : ""}`;
}

export function formatDetailedNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(15) : "-";
}

export function getDetailedSubAttributes(item: RelicView) {
  const grouped = new Map<
    string,
    { key: string; label: string; total: number; values: number[] }
  >();
  for (const roll of item.detail?.growthRolls || []) {
    const attribute = grouped.get(roll.key) || {
      key: roll.key,
      label: roll.label,
      total: 0,
      values: [],
    };
    attribute.total += roll.increase;
    attribute.values.push(roll.increase);
    grouped.set(roll.key, attribute);
  }
  return sortAttributes([...grouped.values()]);
}

function getInitialRollCount(item: RelicView) {
  const rolls = item.detail?.growthRolls || [];
  return (
    item.detail?.initialRollCount ??
    Math.max(0, rolls.length - Math.floor((item.level || 0) / 3))
  );
}

export function getAttributeHitCount(item: RelicView, label: string) {
  const total =
    item.enhancement?.totals?.find((attribute) => attribute.label === label)
      ?.count || 0;
  const startsWithAttribute = (item.detail?.growthRolls || [])
    .slice(0, getInitialRollCount(item))
    .some((roll) => roll.label === label);
  return Math.max(0, total - Number(startsWithAttribute));
}

export function getStageAttributeHitCount(
  item: RelicView,
  attribute: StageAttribute,
) {
  const startsWithAttribute = (item.detail?.growthRolls || [])
    .slice(0, getInitialRollCount(item))
    .some((roll) => roll.key === attribute.key);
  return Math.max(0, attribute.values.length - Number(startsWithAttribute));
}
