export type AttributeView = {
  label: string;
  value: number;
  isPercent: boolean;
};

export type GrowthRoll = {
  key: string;
  label: string;
  maxGrowth: number;
  coefficient: number;
  increase: number;
};

export type StageAttribute = {
  key: string;
  label: string;
  value: number;
  values: number[];
};

export type EnhancementStage = {
  level: number;
  available: boolean;
  upgrade: {
    key: string;
    label: string;
    increase: number;
    isNew: boolean;
  } | null;
  mainAttribute: AttributeView | null;
  attributes: StageAttribute[];
};

export type RelicView = {
  id?: string;
  /** 当前账号内的临时收藏标记，不写入全局保存方案。 */
  isSaved?: boolean;
  /** 保存时的来源分组，用于在已保存列表中整组管理。 */
  savedSource?: string;
  /** 保存方案名称；允许同一件御魂被多个方案复用。 */
  savedSources?: string[];
  /** 当前账号内的临时排除标记，只对已收藏御魂生效。 */
  isExcluded?: boolean;
  /** 已排除的保存方案名称，用于区分复用同一件御魂的不同方案。 */
  excludedSavedSources?: string[];
  level?: number;
  quality?: number;
  position?: number;
  suit?: {
    id: number;
    name: string;
    isTwoPieceSet?: boolean;
    twoPieceConfig?: unknown;
  };
  mainAttribute?: AttributeView | null;
  subAttributes?: AttributeView[];
  setBonusAttribute?: AttributeView | null;
  enhancement?: {
    totals?: {
      key: string;
      label: string;
      count: number;
      total: number;
      values: number[];
    }[];
  };
  detail?: {
    growthRolls?: GrowthRoll[];
    initialRollCount?: number;
    enhancementCount?: number;
    enhancementStages?: EnhancementStage[];
  };
};

export type AccountOverview = {
  title?: string;
  name?: string;
  sourceUrl?: string;
  serverName?: string;
  level?: number;
  fengzidu?: number;
  pvpScore?: number;
  pvpStage?: string | number;
  scatteredFirstSpeed?: number;
  luckyFirstSpeed?: number;
  speedHeadCount?: number;
  speedTailCount?: number;
  relicSummary?: number;
  heroSummary?: number;
  collectionSkinCount?: number;
  /** 藏宝阁 damo_count_dict 中物品 ID 411：御行达摩数量 */
  yuxingDama?: number;
  money?: number;
  stamina?: number;
  maxLevelRelicCount?: number;
  soulJade?: number;
  mysteryTalisman?: number;
  realityTalisman?: number;
  summonPower?: number;
  shikigamiDex?: {
    ssr: { owned: number; total: number };
    sp: { owned: number; total: number };
    ur: { owned: number; total: number };
    uncollected500Days: number | null;
    uncollected999Days: number | null;
    uncollectedCoupon: number;
  };
};

/** 藏宝阁账号内实际拥有的一名式神及其技能等级。 */
export type HeroView = {
  instanceId: string;
  heroId: number;
  name: string;
  rarity: number;
  level: number;
  skillLevels: number[];
};

export type RelicDataset = {
  schemaVersion?: number;
  account?: AccountOverview;
  heroes?: HeroView[];
  relicsByPosition: Record<string, RelicView[]>;
};

export type GameConfig = {
  two_suit_yuhun?: Record<string, unknown>;
  /** 典藏皮肤 ID 到名称的静态映射，来自 game_auto_config.js。 */
  collection_skin_data?: Record<string, string>;
};

export * from "./calculator";
export * from "./heroSkills";
export * from "./home";
export * from "./layout";
export * from "./pve";
export * from "./relics";
export * from "./router";
export * from "./speed";
