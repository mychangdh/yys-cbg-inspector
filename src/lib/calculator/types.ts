import type { RelicView } from "@/types";

/** 式神用于计算的基础面板。所有数值都使用游戏面板的显示单位。 */
export type HeroBaseStats = {
  attack: number;
  health: number;
  defense: number;
  speed: number;
  critRate: number;
  critDamage: number;
  effectHit: number;
  effectResistance: number;
};

/** 计算器支持的面板指标。 */
export type CalculatorMetric =
  | "attack"
  | "health"
  | "defense"
  | "speed"
  | "critRate"
  | "critDamage"
  | "effectHit"
  | "effectResistance"
  | "hitResistance"
  | "damage"
  | "healing"
  | "defenseOutput";

export type PanelConstraintKey =
  | "attack"
  | "health"
  | "defense"
  | "speed"
  | "critRate"
  | "critDamage"
  | "effectHit"
  | "effectResistance";

export type CalculatorExtraAttributeKey =
  | "attackPercent"
  | "healthPercent"
  | "defensePercent"
  | "speed"
  | "critRate"
  | "critDamage"
  | "effectHit"
  | "effectResistance";

export type CalculatorFilters = {
  quality: number;
  level: number;
  suitName?: string;
  mainAttributes: Partial<Record<2 | 4 | 6, string[]>>;
  selectedRelicIds?: Partial<Record<number, Set<string>>>;
  selectedSuitNames?: Set<string>;
  suitTwoPieceAttributes?: Map<string, string>;
  requiredFourPiece?: string;
  requiredTwoPieceNames?: Set<string>;
  requiredTwoPieceAttributes?: Set<string>;
  panelConstraints?: Partial<
    Record<PanelConstraintKey, { min?: number; max?: number }>
  >;
  extraAttributes?: Partial<Record<CalculatorExtraAttributeKey, number>>;
  /** 固定四件套搜索的布局分片，仅用于 Worker 并行计算。 */
  fixedPatternIndexes?: number[];
  fastMode?: boolean;
};

export type CalculatedPanel = HeroBaseStats & {
  attackPercent: number;
  healthPercent: number;
  defensePercent: number;
  flatAttack: number;
  flatHealth: number;
  flatDefense: number;
};

export type CalculatorResult = {
  score: number;
  panel: CalculatedPanel;
  relics: RelicView[];
  suits: string[];
  /** 暴击溢出值只用于相同指标时的稳定排序。 */
  criticalRateOverflow?: number;
};

export type CalculatorProgressStage =
  "preparing" | "matching" | "validating" | "ranking";

export type CalculatorProgress = {
  processedRelics: number;
  totalRelics: number;
  stage?: CalculatorProgressStage;
  results?: CalculatorResult[];
};

/** Worker 与页面之间传递的完整计算请求。 */
export type RelicCalculationRequest = {
  relicsByPosition: Record<string, RelicView[]>;
  baseStats: HeroBaseStats;
  metric: CalculatorMetric;
  filters: CalculatorFilters;
  resultLimit?: number;
  fixedSuitPhase?: "unrestricted" | "explicit";
  initialResults?: CalculatorResult[];
};

/** 已选择御魂组合的面板计算输入，不包含任何 UI 状态。 */
export type RelicPanelCalculationInput = {
  baseStats: HeroBaseStats;
  relics: readonly RelicView[];
  suitTwoPieceAttributes?: ReadonlyMap<string, string>;
  extraAttributes?: Partial<Record<CalculatorExtraAttributeKey, number>>;
};
