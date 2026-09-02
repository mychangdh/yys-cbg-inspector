import { deserialize, serialize } from "node:v8";

import type {
  AttributeView,
  GrowthRoll,
  RelicDataset,
  RelicView,
} from "@/types";

const CACHE_FORMAT_VERSION = 1 as const;

type CompactAttribute = [label: number, value: number, isPercent: 0 | 1];
type CompactSuit = [id: number, name: number, isTwoPieceSet: 0 | 1];
type CompactTotal = [key: number, label: number, count: number, total: number];
type CompactGrowthRoll = [key: number, label: number, increase: number];
type CompactHero = [
  instanceId: string,
  heroId: number,
  name: string,
  rarity: number,
  level: number,
  skillLevels: number[],
];
type CompactRelic = [
  id: string | null,
  level: number | null,
  quality: number | null,
  suit: CompactSuit | null,
  mainAttribute: CompactAttribute | null,
  subAttributes: CompactAttribute[],
  setBonusAttribute: CompactAttribute | null,
  enhancementTotals: CompactTotal[],
  growthRolls: CompactGrowthRoll[],
];
type CompactProductDataset = {
  v: typeof CACHE_FORMAT_VERSION;
  s?: number;
  d: string[];
  a?: RelicDataset["account"];
  h?: CompactHero[];
  r: Record<string, CompactRelic[]>;
};
type EnhancementTotal = NonNullable<
  NonNullable<RelicView["enhancement"]>["totals"]
>[number];

type Dictionary = {
  values: string[];
  indexes: Map<string, number>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function createDictionary(dataset: RelicDataset) {
  const dictionary: Dictionary = { values: [], indexes: new Map() };
  const add = (value: string | undefined) => {
    if (value === undefined) return;
    if (dictionary.indexes.has(value)) return;
    dictionary.indexes.set(value, dictionary.values.length);
    dictionary.values.push(value);
  };

  Object.values(dataset.relicsByPosition || {})
    .flat()
    .forEach((relic) => {
      add(relic.suit?.name);
      [
        relic.mainAttribute,
        relic.setBonusAttribute,
        ...(relic.subAttributes || []),
      ]
        .filter((attribute): attribute is AttributeView => Boolean(attribute))
        .forEach((attribute) => add(attribute.label));
      relic.enhancement?.totals?.forEach((attribute) => {
        add(attribute.key);
        add(attribute.label);
      });
      relic.detail?.growthRolls?.forEach((roll) => {
        add(roll.key);
        add(roll.label);
      });
    });

  return dictionary;
}

function dictionaryIndex(dictionary: Dictionary, value: string) {
  const index = dictionary.indexes.get(value);
  if (index === undefined) throw new Error("商品缓存字典缺少字段");
  return index;
}

function packAttribute(
  attribute: AttributeView | null | undefined,
  dictionary: Dictionary,
): CompactAttribute | null {
  return attribute
    ? [
        dictionaryIndex(dictionary, attribute.label),
        attribute.value,
        attribute.isPercent ? 1 : 0,
      ]
    : null;
}

function packRelic(relic: RelicView, dictionary: Dictionary): CompactRelic {
  return [
    relic.id ?? null,
    relic.level ?? null,
    relic.quality ?? null,
    relic.suit
      ? [
          relic.suit.id,
          dictionaryIndex(dictionary, relic.suit.name),
          relic.suit.isTwoPieceSet ? 1 : 0,
        ]
      : null,
    packAttribute(relic.mainAttribute, dictionary),
    (relic.subAttributes || []).map((attribute) =>
      packAttribute(attribute, dictionary),
    ) as CompactAttribute[],
    packAttribute(relic.setBonusAttribute, dictionary),
    (relic.enhancement?.totals || []).map((attribute) => [
      dictionaryIndex(dictionary, attribute.key),
      dictionaryIndex(dictionary, attribute.label),
      attribute.count,
      attribute.total,
    ]),
    (relic.detail?.growthRolls || []).map((roll) => [
      dictionaryIndex(dictionary, roll.key),
      dictionaryIndex(dictionary, roll.label),
      roll.increase,
    ]),
  ];
}

function packDataset(dataset: RelicDataset): CompactProductDataset {
  const dictionary = createDictionary(dataset);
  return {
    v: CACHE_FORMAT_VERSION,
    ...(dataset.schemaVersion === undefined
      ? {}
      : { s: dataset.schemaVersion }),
    d: dictionary.values,
    ...(dataset.account ? { a: dataset.account } : {}),
    ...(dataset.heroes
      ? {
          h: dataset.heroes.map((hero) => [
            hero.instanceId,
            hero.heroId,
            hero.name,
            hero.rarity,
            hero.level,
            hero.skillLevels,
          ]),
        }
      : {}),
    r: Object.fromEntries(
      Object.entries(dataset.relicsByPosition || {}).map(
        ([position, relics]) => [
          position,
          relics.map((relic) => packRelic(relic, dictionary)),
        ],
      ),
    ),
  };
}

function dictionaryValue(dictionary: string[], index: unknown) {
  const value = dictionary[Number(index)];
  if (typeof value !== "string") throw new Error("商品缓存字典字段无效");
  return value;
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function unpackAttribute(
  value: unknown,
  dictionary: string[],
): AttributeView | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  return {
    label: dictionaryValue(dictionary, value[0]),
    value: numberValue(value[1]),
    isPercent: Boolean(value[2]),
  };
}

function unpackTotals(value: unknown, dictionary: string[]) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): EnhancementTotal[] => {
    if (!Array.isArray(item) || item.length < 4) return [];
    return [
      {
        key: dictionaryValue(dictionary, item[0]),
        label: dictionaryValue(dictionary, item[1]),
        count: numberValue(item[2]),
        total: numberValue(item[3]),
      },
    ];
  });
}

function unpackGrowthRolls(value: unknown, dictionary: string[]) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): GrowthRoll[] => {
    if (!Array.isArray(item) || item.length < 3) return [];
    return [
      {
        key: dictionaryValue(dictionary, item[0]),
        label: dictionaryValue(dictionary, item[1]),
        increase: numberValue(item[2]),
      },
    ];
  });
}

function unpackRelic(
  value: unknown,
  position: string,
  dictionary: string[],
): RelicView {
  if (!Array.isArray(value) || value.length < 9) {
    throw new Error("商品缓存御魂记录无效");
  }

  const totals = unpackTotals(value[7], dictionary);
  const growthRolls = unpackGrowthRolls(value[8], dictionary);
  const suit = Array.isArray(value[3])
    ? {
        id: numberValue(value[3][0]),
        name: dictionaryValue(dictionary, value[3][1]),
        isTwoPieceSet: Boolean(value[3][2]),
      }
    : undefined;

  return {
    id: typeof value[0] === "string" ? value[0] : undefined,
    level: value[1] === null ? undefined : numberValue(value[1]),
    quality: value[2] === null ? undefined : numberValue(value[2]),
    position: numberValue(position),
    suit,
    mainAttribute: unpackAttribute(value[4], dictionary),
    subAttributes: Array.isArray(value[5])
      ? value[5].flatMap((attribute) => {
          const unpacked = unpackAttribute(attribute, dictionary);
          return unpacked ? [unpacked] : [];
        })
      : [],
    setBonusAttribute: unpackAttribute(value[6], dictionary),
    ...(totals.length ? { enhancement: { totals } } : {}),
    ...(growthRolls.length ? { detail: { growthRolls } } : {}),
  };
}

function unpackDataset(value: CompactProductDataset): RelicDataset {
  if (value.v !== CACHE_FORMAT_VERSION || !Array.isArray(value.d)) {
    throw new Error("商品缓存版本不兼容");
  }

  const relicsByPosition = Object.fromEntries(
    Object.entries(value.r || {}).map(([position, relics]) => {
      if (!Array.isArray(relics)) throw new Error("商品缓存御魂列表无效");
      return [
        position,
        relics.map((relic) => unpackRelic(relic, position, value.d)),
      ];
    }),
  );
  const dataset: RelicDataset = { relicsByPosition };
  if (typeof value.s === "number") dataset.schemaVersion = value.s;
  if (value.a && typeof value.a === "object") dataset.account = value.a;
  if (Array.isArray(value.h)) {
    dataset.heroes = value.h.map((hero) => ({
      instanceId: String(hero[0] ?? ""),
      heroId: numberValue(hero[1]),
      name: String(hero[2] ?? "未知式神"),
      rarity: numberValue(hero[3]),
      level: numberValue(hero[4]),
      skillLevels: Array.isArray(hero[5])
        ? hero[5].map(numberValue).slice(0, 3)
        : [],
    }));
  }
  return dataset;
}

export function serializeProductCache(dataset: RelicDataset) {
  // 二进制中间态避免再次生成体积更大的 JSON 文本，缓存仍带有自定义版本号。
  return serialize(packDataset(dataset));
}

export function deserializeProductCache(value: Uint8Array) {
  const decoded = deserialize(value);
  if (!isRecord(decoded)) throw new Error("商品缓存格式无效");
  return unpackDataset(decoded as unknown as CompactProductDataset);
}
