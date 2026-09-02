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

export type RelicDataset = {
  schemaVersion?: number;
  account?: AccountOverview;
  heroes?: HeroView[];
  relicsByPosition: Record<string, RelicView[]>;
};

export type RelicSuitConfig = {
  two_suit_yuhun?: Record<string, unknown>;
};
