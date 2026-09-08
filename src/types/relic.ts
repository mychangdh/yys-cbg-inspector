import type { AccountOverview } from "./account";
import type { HeroView } from "./hero";

export type AttributeView = {
  label: string;
  value: number;
  isPercent: boolean;
};

export type GrowthRoll = {
  key: string;
  label: string;
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
      /** 旧版本缓存可能保留每次强化值，新数据不再重复存储。 */
      values?: number[];
    }[];
  };
  detail?: {
    growthRolls?: GrowthRoll[];
    initialRollCount?: number;
    enhancementCount?: number;
    enhancementStages?: EnhancementStage[];
  };
};

export type RelicDataset = {
  schemaVersion?: number;
  account?: AccountOverview;
  heroes?: HeroView[];
  relicsByPosition: Record<string, RelicView[]>;
};

export type RelicSuitConfig = {
  two_suit_yuhun?: Record<string, unknown>;
};
