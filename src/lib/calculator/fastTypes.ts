import type { RelicView } from "@/types";
import type {
  CalculatorFilters,
  CalculatorMetric,
  HeroBaseStats,
} from "./types";

/** 紧凑搜索使用的面板增量维度，避免中间状态携带完整展示对象。 */
export type FastDimension =
  | "attack"
  | "health"
  | "defense"
  | "speed"
  | "critRate"
  | "critDamage"
  | "effectHit"
  | "effectResistance";

export const FAST_DIMENSIONS: readonly FastDimension[] = [
  "attack",
  "health",
  "defense",
  "speed",
  "critRate",
  "critDamage",
  "effectHit",
  "effectResistance",
];

export type FastVector = Record<FastDimension, number>;

export type FastRelic = FastVector & {
  relic: RelicView;
  suit: string;
  hasOnePieceBonus: boolean;
};

export type SearchNode = {
  start: number;
  end: number;
  left?: number;
  right?: number;
  minAttack: number;
  minHealth: number;
  minDefense: number;
  minSpeed: number;
  minCritRate: number;
  minCritDamage: number;
  minEffectHit: number;
  minEffectResistance: number;
  maxAttack: number;
  maxHealth: number;
  maxDefense: number;
  maxSpeed: number;
  maxCritRate: number;
  maxCritDamage: number;
  maxEffectHit: number;
  maxEffectResistance: number;
};

export type PairCandidate = FastVector & { left: FastRelic; right: FastRelic };
export type QuadCandidate = FastVector & {
  first: PairCandidate;
  second: PairCandidate;
};
export type PairSearchTree = {
  pairs: PairCandidate[];
  nodes: SearchNode[];
  root: number;
};

export type FastFixedSuitSearchResult = {
  relics: RelicView[];
  score: number;
  criticalRateOverflow: number;
};

export type FastFixedSuitSearchInput = {
  relicsByPosition: Record<string, RelicView[]>;
  baseStats: HeroBaseStats;
  metric: CalculatorMetric;
  filters: CalculatorFilters;
  resultLimit?: number;
  onProgress?: (processed: number, total: number) => void;
};
