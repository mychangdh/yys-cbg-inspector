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
