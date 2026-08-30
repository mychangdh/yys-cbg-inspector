import type { RelicView } from "../types";
import {
  calculateFastGeneralSearch,
  calculateFastFixedSuitSearch,
  canUseFastGeneralSearch,
  canUseFastFixedSuitSearch,
  type FastFixedSuitSearchResult,
} from "./fastRelicCalculator";
import {
  constrainedMetricUpperBound as constrainedMetricUpperBoundModule,
  panelValueFromStats as panelValueFromStatsModule,
} from "./calculator/searchUpperBounds";
import * as relicStatsModule from "./calculator/relicStats";
import { retainFixedSuitStates as retainFixedSuitStatesModule } from "./calculator/fixedSuitRetention";
import { expandCriticalFixedSuitStates as expandCriticalFixedSuitStatesModule } from "./calculator/fixedSuitExpansion";
import { offerBest as offerBestModule } from "./calculator/boundedHeap";
import {
  createFixedSuitLayoutPlan as createFixedSuitLayoutPlanModule,
  type FixedSuitLayoutPlan,
} from "./calculator/fixedSuitPlan";
import {
  applyExtraPanelAttributes,
  calculateRelicPanel as calculatePanelFromRelics,
  calculatePanelMetric,
  satisfiesPanelRange,
} from "./calculator/panel";
import {
  availableTwoPieceSuitNames as availableTwoPieceSuitNamesModule,
  generalSearchWorkEstimate as generalSearchWorkEstimateModule,
} from "./calculator/searchPreparation";
import {
  calculateFixedSuitLayouts as calculateFixedSuitLayoutsModule,
  type FixedSuitLayoutSearchDependencies,
} from "./calculator/fixedSuitLayoutSearch";
import {
  removeDominatedRelics as removeDominatedRelicsModule,
  maximumCandidateStats as maximumCandidateStatsModule,
  potentialFixedSuitTwoPieceStats as potentialFixedSuitTwoPieceStatsModule,
} from "./calculator/pruning";
import {
  extendFixedSuitState as extendFixedSuitStateModule,
  extendUnrestrictedFixedSuitState as extendUnrestrictedFixedSuitStateModule,
  knownSuitSteps as knownSuitStepsModule,
  knownFixedSuitSteps as knownFixedSuitStepsModule,
  extendKnownSuitState as extendKnownSuitStateModule,
} from "./calculator/fixedSuitState";
import { selectFixedPatternCandidates } from "./calculator/fixedCandidates";
import { resultFromState as resultFromStateModule } from "./calculator/stateResult";
import { relicsForState as relicsForStateModule } from "./calculator/fixedSuitState";
import {
  constraintsForSearch as constraintsForSearchModule,
  requirementSignature as requirementSignatureModule,
  panelConstraintProgress as panelConstraintProgressModule,
  panelConstraintBucketSignature as panelConstraintBucketSignatureModule,
} from "./calculator/searchConstraints";
import { prioritizeCalculatorResults as prioritizeCalculatorResultsModule } from "./calculator/resultRanking";
import { takeBest as takeBestModule } from "./calculator/topK";
import { prepareEligibleRelics } from "./calculator/generalCandidates";
import { fastSearchResultToCalculatorResult } from "./calculator/fastResultAdapter";
import { runGeneralBeamSearch } from "./calculator/generalBeamSearch";
import { prepareGeneralCandidates } from "./calculator/generalCandidateFrontier";
import {
  candidateLimitForTotalRelics,
  fixedPatternCandidateLimitForTotalRelics,
} from "./calculator/candidateBudget";
/**
 * 计算器在本地搜索六个固定号位。这里使用有上限的束搜索，而不是枚举
 * 全部六件御魂排列：每一层保留当前指标较强的候选，同时按套装、暴击
 * 和面板约束分桶，避免单件看起来较弱的御魂在凑成套装前被提前淘汰。
 */
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
  /** 固定四件套布局的分片编号，仅供并行 Worker 拆分独立搜索任务。 */
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
  /** 原始暴击溢出，仅用于同分时优先选择更高效的配置。 */
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
/** 可由页面、Worker 或后续功能独立构造的御魂组合计算请求。 */
export type RelicCalculationRequest = {
  relicsByPosition: Record<string, RelicView[]>;
  baseStats: HeroBaseStats;
  metric: CalculatorMetric;
  filters: CalculatorFilters;
  resultLimit?: number;
  /** 将全覆盖两件套搜索拆为两个 Worker 阶段时使用。 */
  fixedSuitPhase?: "unrestricted" | "explicit";
  initialResults?: CalculatorResult[];
};
/** 已选御魂的最终面板计算输入，不包含任何 UI 状态。 */
export type RelicPanelCalculationInput = {
  baseStats: HeroBaseStats;
  relics: readonly RelicView[];
  suitTwoPieceAttributes?: ReadonlyMap<string, string>;
  extraAttributes?: Partial<Record<CalculatorExtraAttributeKey, number>>;
};
type StatBag = Record<string, number>;
type BaseStatsWithBuffs = HeroBaseStats & {
  buffPercents?: Pick<
    StatBag,
    "attackPercent" | "healthPercent" | "defensePercent"
  >;
};
type SuitCounts = Readonly<Record<string, number>>;
type RelicChain = {
  relic: RelicView;
  previous?: RelicChain;
};
type BeamState = {
  relics?: RelicChain;
  stats: StatBag;
  suitCounts: SuitCounts;
};
type KnownSuitStep = {
  suitCounts: SuitCounts;
  twoPieceBonus?: RelicView["mainAttribute"];
};
type PatternCandidateSet = {
  candidates: RelicView[];
  matchingCount: number;
  undominated: RelicView[];
};
export type FixedSuitCandidateCache = Map<string, PatternCandidateSet>;
/** 同一 Worker 的两阶段固定套搜索可复用的只读准备结果。 */
export type RelicCalculationCache = {
  eligibleRelics?: RelicView[][];
  fixedSuitCandidateCache: FixedSuitCandidateCache;
};
// 搜索核心使用的属性维度固定。数值向量是后续紧凑状态搜索的基础：避免在
// 每次扩展时通过字符串键遍历御魂词条。展示和最终结果仍保留 StatBag/RelicView。
const STAT_VECTOR_KEYS = [
  "attack",
  "health",
  "defense",
  "speed",
  "critRate",
  "critDamage",
  "attackPercent",
  "healthPercent",
  "defensePercent",
  "effectHit",
  "effectResistance",
] as const;
const STAT_VECTOR_INDEX = new Map<string, number>(
  STAT_VECTOR_KEYS.map((key, index) => [key, index]),
);
const STAT_VECTOR = {
  attack: 0,
  health: 1,
  defense: 2,
  speed: 3,
  critRate: 4,
  critDamage: 5,
  attackPercent: 6,
  healthPercent: 7,
  defensePercent: 8,
  effectHit: 9,
  effectResistance: 10,
} as const;
type StatVector = Float64Array;
// 束搜索会生成大量中间状态。固定属性键顺序可避免不同御魂词条组合让
// JavaScript 引擎反复创建隐藏类，数值仍按原始属性累加。
const EMPTY_STAT_BAG: StatBag = Object.freeze({
  attack: 0,
  health: 0,
  defense: 0,
  speed: 0,
  critRate: 0,
  critDamage: 0,
  attackPercent: 0,
  healthPercent: 0,
  defensePercent: 0,
  effectHit: 0,
  effectResistance: 0,
});
function createEmptyStatBag(): StatBag {
  return { ...EMPTY_STAT_BAG };
}
// 单件御魂的属性在一次页面会话中不会变化。组合搜索会反复使用同一对象，
// 因此用 WeakMap 缓存解析结果，避免在每次扩展候选时重新遍历主属性和副属性。
const relicLocalScoreCache = new WeakMap<
  RelicView,
  WeakMap<BaseStatsWithBuffs, Map<CalculatorMetric, number>>
>();
const twoPieceAttributeCache = new Map<
  string,
  RelicView["mainAttribute"] | null
>();
const POSITION_ORDER = [1, 2, 3, 4, 5, 6] as const;
// 多个面板约束同时存在时，单件局部评分不能代表最终组合价值；保留更宽的候选前沿，
// 给速度、满暴、暴击伤害和套装条件留下共同满足的路径。
const MAX_CANDIDATES_PER_POSITION = 64;
const REQUIRED_CANDIDATE_RESERVE = 20;
const COMPOSITE_SLOT_SIX_CRIT_DAMAGE_RESERVE = 12;
const REQUIRED_CONSTRAINT_CANDIDATE_RESERVE = 12;
const BEAM_WIDTH = 360;
const REQUIREMENT_BEAM_WIDTH = 144;
// 固定四件套只有 15 种号位分配，搜索空间远小于通用组合。这里保留更宽的
// 前沿，防止“满暴 + 速度”约束先满足后，高攻击/高爆伤路线被错误裁掉。
const FIXED_SUIT_BEAM_WIDTH = 320;
const FIXED_SUIT_CRIT_BUCKET_WIDTH = 12;
const FIXED_SUIT_CONSTRAINT_BUCKET_COUNT = 8;
// 固定套装会枚举 15 种号位布局。候选不能只按单件指标截断，否则同时满足
// 速度、满暴和主属性范围的路线会在进入束搜索前消失。
const FIXED_PATTERN_CANDIDATE_LIMIT = 360;
const FIXED_PATTERN_LOCAL_RESERVE = 72;
const FIXED_PATTERN_STAT_RESERVE = 48;
const FIXED_PATTERN_CRIT_DAMAGE_RESERVE = 112;
const FULL_CRIT_BUCKET_WIDTH = 8;
// 极速模式只缩减结果数量，不缩减任何影响最优解的候选、分桶或搜索前沿。
// 速度来自固定套装布局的并行计算；若为了速度收窄前沿，复杂约束下会错误
// 排除局部属性较弱、但最终面板更高的组合。
// 极速模式不能缩小会影响第一名的搜索前沿，否则不同约束组合可能得到
// 与普通模式不同的结果。速度差异由 Worker 并行、上界剪枝、结果限一和
// 轻量进度消息提供；这些参数保持与普通模式一致以保证结果空间一致。
const FAST_BEAM_WIDTH = BEAM_WIDTH;
const FAST_REQUIREMENT_BEAM_WIDTH = REQUIREMENT_BEAM_WIDTH;
const FAST_FULL_CRIT_BUCKET_WIDTH = FULL_CRIT_BUCKET_WIDTH;
const FAST_FIXED_SUIT_BEAM_WIDTH = FIXED_SUIT_BEAM_WIDTH;
const FAST_FIXED_SUIT_STATE_RESERVE = 72;
const FAST_FIXED_SUIT_CRIT_BUCKET_WIDTH = FIXED_SUIT_CRIT_BUCKET_WIDTH;
const FAST_FIXED_SUIT_CONSTRAINT_BUCKET_COUNT =
  FIXED_SUIT_CONSTRAINT_BUCKET_COUNT;
const FAST_FIXED_PATTERN_CANDIDATE_LIMIT = FIXED_PATTERN_CANDIDATE_LIMIT;
const FAST_FIXED_PATTERN_LOCAL_RESERVE = FIXED_PATTERN_LOCAL_RESERVE;
const FAST_FIXED_PATTERN_STAT_RESERVE = FIXED_PATTERN_STAT_RESERVE;
const FAST_FIXED_PATTERN_CRIT_DAMAGE_RESERVE =
  FIXED_PATTERN_CRIT_DAMAGE_RESERVE;
const CRIT_RATE_CAP_TOLERANCE = 0.01;
function canonical(label = "") {
  if (label.includes("速度")) return "speed";
  if (label.includes("暴击伤害") || label.includes("爆伤")) return "critDamage";
  if (label.includes("暴击")) return "critRate";
  if (label.includes("攻击加成")) return "attackPercent";
  if (label === "攻击" || label.includes("攻击")) return "attack";
  if (label.includes("生命加成")) return "healthPercent";
  if (label === "生命" || label.includes("生命")) return "health";
  if (label.includes("防御加成")) return "defensePercent";
  if (label === "防御" || label.includes("防御")) return "defense";
  if (label.includes("效果命中")) return "effectHit";
  if (label.includes("效果抵抗")) return "effectResistance";
  return "other";
}
function addAttribute(stats: StatBag, attribute: RelicView["mainAttribute"]) {
  if (!attribute) return;
  const key = canonical(attribute.label);
  if (key !== "other")
    stats[key] = (stats[key] || 0) + Number(attribute.value || 0);
}
function relicStatsFor(relic: RelicView) {
  return relicStatsModule.relicStatsFor(relic);
  /*
  // 逢魔御魂的 single_attr 是每件独立生效的额外属性，装备一件就立即计入。
  addAttribute(stats, relic.setBonusAttribute);
  */
}
/** 单件御魂在组合搜索中会被复用数十万次，键值对数组也必须只创建一次。 */
function relicStatEntriesFor(relic: RelicView) {
  return relicStatsModule.relicStatEntriesFor(relic);
}
function relicStatVectorFor(relic: RelicView) {
  return relicStatsModule.relicStatVectorFor(relic);
}
function relicStatValue(relic: RelicView, key: string) {
  return relicStatsModule.relicStatValue(relic, key);
}
/**
 * 返回单件御魂可计入面板的属性汇总。
 * 返回副本避免调用方修改内部 WeakMap 缓存，后续重复计算仍可复用缓存。
 */
export function calculateRelicStatTotals(relic: RelicView) {
  return relicStatsModule.calculateRelicStatTotals(relic);
}
function addStats(target: StatBag, source: StatBag) {
  relicStatsModule.addStats(target, source);
}
function addRelic(stats: StatBag, relic: RelicView) {
  relicStatsModule.addRelic(stats, relic);
}
function localScore(
  relic: RelicView,
  metric: CalculatorMetric,
  base: BaseStatsWithBuffs,
) {
  const cachedByBase = relicLocalScoreCache.get(relic);
  const cachedScores = cachedByBase?.get(base);
  const cached = cachedScores?.get(metric);
  if (cached !== undefined) return cached;
  const stats: StatBag = {};
  addRelic(stats, relic);
  const score = metricValue(panelFor(base, stats), metric);
  const scores = cachedScores || new Map<CalculatorMetric, number>();
  scores.set(metric, score);
  if (cachedByBase) {
    if (!cachedScores) cachedByBase.set(base, scores);
  } else {
    const scoresByBase = new WeakMap<
      BaseStatsWithBuffs,
      Map<CalculatorMetric, number>
    >();
    scoresByBase.set(base, scores);
    relicLocalScoreCache.set(relic, scoresByBase);
  }
  return score;
}
function panelFor(base: BaseStatsWithBuffs, stats: StatBag): CalculatedPanel {
  const buffPercents: Partial<
    Pick<StatBag, "attackPercent" | "healthPercent" | "defensePercent">
  > = base.buffPercents || {};
  const attackPercent =
    (stats.attackPercent || 0) + (buffPercents.attackPercent || 0);
  const healthPercent =
    (stats.healthPercent || 0) + (buffPercents.healthPercent || 0);
  const defensePercent =
    (stats.defensePercent || 0) + (buffPercents.defensePercent || 0);
  return {
    // 这是束搜索最热的路径。显式构造稳定字段形状，避免每个中间状态都
    // 通过对象展开复制 base 以及其内部的 buffPercents。
    attack: base.attack * (1 + attackPercent / 100) + (stats.attack || 0),
    health: base.health * (1 + healthPercent / 100) + (stats.health || 0),
    defense: base.defense * (1 + defensePercent / 100) + (stats.defense || 0),
    speed: base.speed + (stats.speed || 0),
    // 面板保留暴击原始值供查看。暴击超过 100% 不再增加复合指标，
    // 但详情中仍要展示真实溢出值。
    critRate: base.critRate + (stats.critRate || 0),
    critDamage: base.critDamage + (stats.critDamage || 0),
    effectHit: base.effectHit + (stats.effectHit || 0),
    effectResistance: base.effectResistance + (stats.effectResistance || 0),
    attackPercent,
    healthPercent,
    defensePercent,
    flatAttack: stats.attack || 0,
    flatHealth: stats.health || 0,
    flatDefense: stats.defense || 0,
  };
}
function applyExtraAttributes(
  base: HeroBaseStats,
  extraAttributes?: CalculatorFilters["extraAttributes"],
): BaseStatsWithBuffs {
  return applyExtraPanelAttributes(base, extraAttributes);
}
/**
 * 计算指定御魂组合的最终面板。
 * 与组合搜索使用完全相同的主属性、副属性、逢魔一件套与普通两件套规则。
 */
export function calculateRelicPanel({
  baseStats,
  relics,
  suitTwoPieceAttributes,
  extraAttributes,
}: RelicPanelCalculationInput): CalculatedPanel {
  return calculatePanelFromRelics({
    baseStats,
    relics,
    suitTwoPieceAttributes,
    extraAttributes,
  });
}
function metricValue(panel: CalculatedPanel, metric: CalculatorMetric) {
  return calculatePanelMetric(panel, metric);
}

/**
 * 将搜索状态转换为页面使用的完整结果。
 * 状态搜索模块只负责枚举和剪枝，面板与排序规则仍由主计算入口统一提供。
 */
function resultForState(
  state: BeamState,
  base: HeroBaseStats,
  metric: CalculatorMetric,
): CalculatorResult {
  return resultFromStateModule(
    state,
    base,
    metric,
    panelFor,
    metricValue,
    criticalRateOverflow,
  );
}

function isFastDamageConstraintPath(
  metric: CalculatorMetric,
  filters: CalculatorFilters,
) {
  if (
    !filters.fastMode ||
    metric !== "damage" ||
    (filters.panelConstraints?.critRate?.min || 0) < 100 ||
    filters.panelConstraints?.speed?.min === undefined
  )
    return false;
  return Object.keys(filters.panelConstraints || {}).every(
    (key) => key === "speed" || key === "critRate",
  );
}
function fastDamageValues(base: BaseStatsWithBuffs, stats: StatBag) {
  const attackPercent =
    (stats.attackPercent || 0) + (base.buffPercents?.attackPercent || 0);
  return {
    attack: base.attack * (1 + attackPercent / 100) + (stats.attack || 0),
    speed: base.speed + (stats.speed || 0),
    critRate: base.critRate + (stats.critRate || 0),
    critDamage: base.critDamage + (stats.critDamage || 0),
  };
}
/**
 * 极速模式会对大量中间状态执行上界判断。这里直接读取原始词条并计算所需
 * 面板字段，避免每次判断都创建完整 CalculatedPanel 和临时 StatBag 对象。
 */
/** 仅当上限已超出或理论上限不可能获胜时返回 true，不改变可行结果。 */
/**
 * 计算满足面板上限时的指标理论上界。攻击上限为 7700 时，任何攻击更高的
 * 乐观面板都不可能成为有效结果，因此不能再拿它与当前第 N 名比较。
 */
function cannotBeatFastResult(
  base: BaseStatsWithBuffs,
  stats: StatBag,
  future: StatBag,
  potentialBonus: StatBag,
  metric: CalculatorMetric,
  constraints: CalculatorFilters["panelConstraints"],
  bestScore: number,
) {
  for (const [rawKey, range] of Object.entries(constraints || {})) {
    const key = rawKey as PanelConstraintKey;
    if (
      range?.max !== undefined &&
      panelValueFromStatsModule(base, stats, key) > range.max
    ) {
      return true;
    }
    if (
      range?.min !== undefined &&
      panelValueFromStatsModule(base, stats, key, future, potentialBonus) <
        range.min
    ) {
      return true;
    }
  }
  return (
    constrainedMetricUpperBoundModule(
      base,
      stats,
      future,
      potentialBonus,
      metric,
      constraints,
    ) < bestScore
  );
}
/** 独立计算任意最终面板对应的指标数值。 */
export function calculateMetricValue(
  panel: CalculatedPanel,
  metric: CalculatorMetric,
) {
  return metricValue(panel, metric);
}
/**
 * 未指定套装时，单件套装尚未凑齐不会立刻出现在面板中。若只按当前面板裁剪，
 * 例如“无刀取 +20% 暴击伤害”的第一件会被高词条散件淘汰。这里估计每个
 * 已有一件套装在下一件凑齐后对当前指标的增益，用于保留该搜索路径；最终
 * 结果仍然只使用真实已触发的套装属性。
 */
function parseTwoPieceAttribute(text?: string) {
  const cacheKey = String(text || "");
  const cached = twoPieceAttributeCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const match = String(text || "").match(
    /^(速度|暴击伤害|暴击|攻击加成|攻击|生命加成|生命|防御加成|防御|效果命中|效果抵抗)\s*\+?\s*(\d+(?:\.\d+)?)%?$/,
  );
  if (!match) {
    twoPieceAttributeCache.set(cacheKey, null);
    return null;
  }
  const parsed = {
    label: match[1],
    value: Number(match[2]),
    isPercent: text?.includes("%") || false,
  };
  twoPieceAttributeCache.set(cacheKey, parsed);
  return parsed;
}
export function satisfiesPanelConstraints(
  panel: CalculatedPanel,
  constraints: CalculatorFilters["panelConstraints"],
) {
  return satisfiesPanelRange(panel, constraints);
}
function usesCriticalRateCap(metric: CalculatorMetric) {
  return (
    metric === "damage" || metric === "healing" || metric === "defenseOutput"
  );
}
function hasFullCriticalRateConstraint(
  filters: CalculatorFilters,
  metric: CalculatorMetric,
) {
  return (
    usesCriticalRateCap(metric) &&
    (filters.panelConstraints?.critRate?.min || 0) >= 100
  );
}
function rawCriticalRate(state: BeamState, base: HeroBaseStats) {
  return base.critRate + (state.stats.critRate || 0);
}
function criticalRateBucket(state: BeamState, base: HeroBaseStats) {
  // 每 1% 暴击保留一条独立前沿，避免高暴击路径在六个号位完成前挤掉刚好满暴的路径。
  return Math.floor(rawCriticalRate(state, base) + Number.EPSILON);
}
function criticalRateDiverseCandidates(
  relics: RelicView[],
  metric: CalculatorMetric,
  filters: CalculatorFilters,
) {
  if (!hasFullCriticalRateConstraint(filters, metric)) return [];
  // 同一暴击率下的高爆伤御魂是双暴指标的重要路线，不能只按暴击率保留。
  const groups = new Map<string, RelicView[]>();
  relics.forEach((relic) => {
    const vector = relicStatVectorFor(relic);
    const critRate = vector[STAT_VECTOR.critRate];
    const critDamage = vector[STAT_VECTOR.critDamage];
    const bucket = `${Math.floor(critRate + Number.EPSILON)}|${Math.floor(
      critDamage / 5,
    )}`;
    const group = groups.get(bucket);
    if (group) group.push(relic);
    else groups.set(bucket, [relic]);
  });
  // 调用方传入的候选已按 localScore 降序排列，按暴击分桶后组内顺序仍然
  // 不变。每档直接取前两件即可，避免每个桶都再次排序。
  return [...groups.values()].flatMap((items) => items.slice(0, 2));
}
function criticalRateOverflow(state: BeamState, base: HeroBaseStats) {
  return Math.max(0, rawCriticalRate(state, base) - 100);
}
function compareCriticalOverflow(
  left: BeamState,
  right: BeamState,
  base: HeroBaseStats,
  metric: CalculatorMetric,
) {
  if (!usesCriticalRateCap(metric)) return 0;
  return criticalRateOverflow(left, base) - criticalRateOverflow(right, base);
}
export function prioritizeCalculatorResults(
  results: CalculatorResult[],
  filters: CalculatorFilters,
  metric: CalculatorMetric,
  resultLimit: number,
) {
  // 约束只决定组合是否合格，最终排序只看用户选择的指标。
  // 超过 100% 的暴击保留在面板中，但不额外增加伤害、治疗和防御输出指标。
  const uniqueResults: CalculatorResult[] = [];
  const seen = new Set<string>();
  results.forEach((result) => {
    // Worker 实时预览与结束消息会在主线程再次合并。这里统一做最终约束校验，
    // 防止任何未完成校验的中间候选进入结果区，例如“满暴”出现不足 100% 的组合。
    if (!satisfiesPanelConstraints(result.panel, filters.panelConstraints)) {
      return;
    }
    const signature = result.relics
      .map((relic) => String(relic.id))
      .sort()
      .join("|");
    if (seen.has(signature)) return;
    seen.add(signature);
    uniqueResults.push(result);
  });
  return uniqueResults
    .sort(
      (left, right) =>
        right.score - left.score ||
        (left.criticalRateOverflow || 0) - (right.criticalRateOverflow || 0),
    )
    .slice(0, resultLimit);
}
/**
 * 稳定取排序结果的前 K 项。
 * 原实现会先完整排序几万条中间状态再截取前 320 条，堆选择只保留前 K 项，
 * 最后再对这 K 项排序；比较器和原始索引完全沿用，所以不会改变结果顺序。
 */
function takeBest<T>(
  items: T[],
  limit: number,
  compare: (left: T, right: T) => number,
) {
  if (limit <= 0 || !items.length) return [] as T[];
  const compareIndexed = (
    left: { value: T; index: number },
    right: { value: T; index: number },
  ) => compare(left.value, right.value) || left.index - right.index;
  if (items.length <= limit) return items.slice().sort(compare);
  const heap: { value: T; index: number }[] = [];
  const isWorse = (
    left: { value: T; index: number },
    right: { value: T; index: number },
  ) => compareIndexed(left, right) > 0;
  const siftUp = (index: number) => {
    let child = index;
    while (child > 0) {
      const parent = Math.floor((child - 1) / 2);
      if (!isWorse(heap[child], heap[parent])) break;
      [heap[child], heap[parent]] = [heap[parent], heap[child]];
      child = parent;
    }
  };
  const siftDown = (index: number) => {
    let parent = index;
    while (true) {
      const left = parent * 2 + 1;
      const right = left + 1;
      let worst = parent;
      if (left < heap.length && isWorse(heap[left], heap[worst])) worst = left;
      if (right < heap.length && isWorse(heap[right], heap[worst]))
        worst = right;
      if (worst === parent) break;
      [heap[parent], heap[worst]] = [heap[worst], heap[parent]];
      parent = worst;
    }
  };
  items.forEach((value, index) => {
    const entry = { value, index };
    if (heap.length < limit) {
      heap.push(entry);
      siftUp(heap.length - 1);
    } else if (isWorse(heap[0], entry)) {
      heap[0] = entry;
      siftDown(0);
    }
  });
  return heap
    .slice()
    .sort(compareIndexed)
    .map((entry) => entry.value);
}
function calculateFixedSuitLayouts(
  eligibleRelics: RelicView[][],
  base: HeroBaseStats,
  metric: CalculatorMetric,
  filters: CalculatorFilters,
  fixedSuitName: string,
  fixedPieceCount: 2 | 4,
  twoPieceNames: readonly string[] | undefined,
  resultLimit: number,
  progress?: (value: CalculatorProgress) => void,
  layoutPlan?: FixedSuitLayoutPlan,
  initialBestResults?: readonly CalculatorResult[],
  sharedPatternCandidateCache?: FixedSuitCandidateCache,
): CalculatorResult[] {
  const fixedPatternCandidateLimit = fixedPatternCandidateLimitForTotalRelics(
    eligibleRelics.reduce((total, items) => total + items.length, 0),
  );
  const dependencies: FixedSuitLayoutSearchDependencies = {
    positionCount: POSITION_ORDER.length,
    fixedSuitBeamWidth: FIXED_SUIT_BEAM_WIDTH,
    fastFixedSuitBeamWidth: FAST_FIXED_SUIT_BEAM_WIDTH,
    fixedSuitCritBucketWidth: FIXED_SUIT_CRIT_BUCKET_WIDTH,
    fastFixedSuitCritBucketWidth: FAST_FIXED_SUIT_CRIT_BUCKET_WIDTH,
    fixedSuitConstraintBucketCount: FIXED_SUIT_CONSTRAINT_BUCKET_COUNT,
    fastFixedSuitConstraintBucketCount: FAST_FIXED_SUIT_CONSTRAINT_BUCKET_COUNT,
    fastFixedSuitStateReserve: FAST_FIXED_SUIT_STATE_RESERVE,
    createEmptyStatBag,
    addStats,
    maximumCandidateStats: maximumCandidateStatsModule,
    removeDominatedRelics: (
      matching,
      searchMetric,
      searchFilters,
      searchBase,
    ) =>
      removeDominatedRelicsModule(
        matching,
        searchMetric,
        searchFilters,
        (relic) => localScore(relic, searchMetric, searchBase),
      ),
    fixedPatternCandidates: (
      matching,
      positionIndex,
      _candidateBase,
      searchMetric,
      searchFilters,
    ) =>
      selectFixedPatternCandidates(
        matching,
        positionIndex,
        searchMetric,
        searchFilters,
        {
          candidateLimit: searchFilters.fastMode
            ? FAST_FIXED_PATTERN_CANDIDATE_LIMIT
            : fixedPatternCandidateLimit,
          localReserve: searchFilters.fastMode
            ? FAST_FIXED_PATTERN_LOCAL_RESERVE
            : FIXED_PATTERN_LOCAL_RESERVE,
          statReserve: searchFilters.fastMode
            ? FAST_FIXED_PATTERN_STAT_RESERVE
            : FIXED_PATTERN_STAT_RESERVE,
          critDamageReserve: searchFilters.fastMode
            ? FAST_FIXED_PATTERN_CRIT_DAMAGE_RESERVE
            : FIXED_PATTERN_CRIT_DAMAGE_RESERVE,
        },
        criticalRateDiverseCandidates,
      ),
    potentialFixedSuitTwoPieceStats: potentialFixedSuitTwoPieceStatsModule,
    knownSuitSteps: knownSuitStepsModule,
    knownFixedSuitSteps: knownFixedSuitStepsModule,
    extendFixedSuitState: extendFixedSuitStateModule,
    extendUnrestrictedFixedSuitState: extendUnrestrictedFixedSuitStateModule,
    extendKnownSuitState: extendKnownSuitStateModule,
    usesCriticalRateCap,
    isFastDamageConstraintPath,
    fastDamageValues,
    panelFor,
    metricValue,
    satisfiesPanelConstraints,
    prioritizeResults: (results, searchFilters, searchMetric, resultLimit) =>
      prioritizeCalculatorResultsModule(
        results,
        searchFilters,
        searchMetric,
        resultLimit,
      ),
    resultForState,
    constraintsForSearch: constraintsForSearchModule,
    panelConstraintProgress: panelConstraintProgressModule,
    panelConstraintBucketSignature: panelConstraintBucketSignatureModule,
    criticalRateOverflow,
    compareCriticalOverflow,
    takeBest: takeBestModule,
    offerBest: offerBestModule,
    expandCriticalFixedSuitStates: expandCriticalFixedSuitStatesModule,
    retainFixedSuitStates: retainFixedSuitStatesModule,
    createLayoutPlan: createFixedSuitLayoutPlanModule,
    constrainedMetricUpperBound: constrainedMetricUpperBoundModule,
  };
  return calculateFixedSuitLayoutsModule(
    eligibleRelics,
    base,
    metric,
    filters,
    fixedSuitName,
    fixedPieceCount,
    twoPieceNames,
    resultLimit,
    progress,
    layoutPlan,
    initialBestResults,
    sharedPatternCandidateCache,
    dependencies,
  );
}

function calculateFixedTwoPieceAttribute(
  eligibleRelics: RelicView[][],
  base: HeroBaseStats,
  metric: CalculatorMetric,
  filters: CalculatorFilters,
  matchingSuitNames: readonly string[],
  resultLimit: number,
  progress?: (value: CalculatorProgress) => void,
) {
  const results = matchingSuitNames.flatMap((suitName) =>
    calculateFixedSuitLayouts(
      eligibleRelics,
      base,
      metric,
      filters,
      suitName,
      2,
      undefined,
      resultLimit,
      progress,
    ),
  );
  return prioritizeCalculatorResults(results, filters, metric, resultLimit);
}

/**
 * 两件套必须来自两个不同号位。仅保留当前候选池中至少覆盖两个号位的套装，
 * 这样只会跳过物理上无法触发两件套效果的分支，不会缩小有效组合的搜索范围。
 */
function calculatorResultForFastFixedSuitSearch(
  compactResult: FastFixedSuitSearchResult,
  base: HeroBaseStats,
  metric: CalculatorMetric,
  filters: CalculatorFilters,
): CalculatorResult | undefined {
  return fastSearchResultToCalculatorResult(
    compactResult,
    base,
    metric,
    filters,
    calculateRelicPanel,
    metricValue,
    satisfiesPanelConstraints,
  );
}

export function calculateRelicCombinations(
  relicsByPosition: Record<string, RelicView[]>,
  base: HeroBaseStats,
  metric: CalculatorMetric,
  filters: CalculatorFilters,
  resultLimit = 20,
  progress?: (value: CalculatorProgress) => void,
  fixedSuitPhase?: RelicCalculationRequest["fixedSuitPhase"],
  initialResults?: CalculatorResult[],
  calculationCache?: RelicCalculationCache,
): CalculatorResult[] {
  base = applyExtraAttributes(base, filters.extraAttributes);
  const requiredPieceCount =
    (filters.requiredFourPiece ? 4 : 0) +
    ((filters.requiredTwoPieceNames?.size || 0) +
      (filters.requiredTwoPieceAttributes?.size || 0)) *
      2;
  if (requiredPieceCount > POSITION_ORDER.length) return [];

  // 如果请求符合固定四件套搜索的严格支配规则，优先使用精确的固定四件套路径。
  // 其余组合和约束形状交给通用搜索处理，包括无四件套和 2+2+2 布局。
  const shouldUseCompactFixedSuitSearch = canUseFastFixedSuitSearch(
    filters,
    metric,
    resultLimit,
    base,
  );
  const canUseCompactGeneralSearch =
    !shouldUseCompactFixedSuitSearch &&
    canUseFastGeneralSearch(filters, resultLimit) &&
    generalSearchWorkEstimateModule(
      relicsByPosition,
      filters,
      POSITION_ORDER,
    ) <= 2_000_000;
  let compactGeneralTopResult: CalculatorResult | undefined;
  if (
    !filters.fastMode &&
    canUseCompactGeneralSearch &&
    fixedSuitPhase !== "explicit"
  ) {
    const compactResults = calculateFastGeneralSearch({
      relicsByPosition,
      baseStats: base,
      metric,
      filters: { ...filters, fastMode: true },
      resultLimit: 1,
    });
    compactGeneralTopResult = compactResults
      .map((result) =>
        calculatorResultForFastFixedSuitSearch(result, base, metric, filters),
      )
      .find((result): result is CalculatorResult => Boolean(result));
  }
  // 固定四件套紧凑路径由普通和极速模式共用，始终保留真实候选并返回请求的结果数量；
  // 通用紧凑路径在极速模式下仍只返回第一名。
  if (
    shouldUseCompactFixedSuitSearch ||
    (filters.fastMode && canUseCompactGeneralSearch)
  ) {
    if (fixedSuitPhase === "explicit") return initialResults || [];

    if (shouldUseCompactFixedSuitSearch) {
      const compactResults = calculateFastFixedSuitSearch({
        relicsByPosition,
        baseStats: base,
        metric,
        filters,
        resultLimit,
        onProgress: (processed, total) =>
          progress?.({
            processedRelics: processed,
            totalRelics: total,
            stage: processed >= total ? "ranking" : "matching",
          }),
      });
      const calculatorResults = compactResults
        .map((result) =>
          calculatorResultForFastFixedSuitSearch(result, base, metric, filters),
        )
        .filter((result): result is CalculatorResult => Boolean(result));
      return prioritizeCalculatorResults(
        calculatorResults,
        filters,
        metric,
        resultLimit,
      );
    }
    const compactResults = calculateFastGeneralSearch({
      relicsByPosition,
      baseStats: base,
      metric,
      filters,
      resultLimit,
      onProgress: (processed, total) =>
        progress?.({
          processedRelics: processed,
          totalRelics: total,
          stage: processed >= total ? "ranking" : "matching",
        }),
    });
    const calculatorResults = compactResults
      .map((result) =>
        calculatorResultForFastFixedSuitSearch(result, base, metric, filters),
      )
      .filter((result): result is CalculatorResult => Boolean(result));
    return prioritizeCalculatorResults(
      calculatorResults,
      filters,
      metric,
      resultLimit,
    );
  }

  // 固定套装紧凑核心只保留真实且精确的组合，并使用标准计算重新构造面板。
  // 普通模式会把它的第一名作为旧版 Top-N 路径的精确种子，修复束搜索遗漏，
  // 同时不会丢弃普通模式的其他结果。
  const compactFilters = filters.fastMode
    ? filters
    : { ...filters, fastMode: true };
  const canUseCompactFixedSuitSearch = canUseFastFixedSuitSearch(
    compactFilters,
    metric,
    1,
    base,
    fixedSuitPhase,
  );
  let compactTopResult: CalculatorResult | undefined;
  if (canUseCompactFixedSuitSearch) {
    const compactResults = calculateFastFixedSuitSearch({
      relicsByPosition,
      baseStats: base,
      metric,
      filters: compactFilters,
      resultLimit: 1,
      onProgress: (processed, total) =>
        progress?.({
          processedRelics: processed,
          totalRelics: total,
          stage: processed >= total ? "ranking" : "matching",
        }),
    });
    const compactCalculatorResults = compactResults
      .map((result) =>
        calculatorResultForFastFixedSuitSearch(result, base, metric, filters),
      )
      .filter((result): result is CalculatorResult => Boolean(result));
    const compactResult = compactResults[0];
    if (!compactResult) {
    } else {
      const panel = calculateRelicPanel({
        baseStats: base,
        relics: compactResult.relics,

        suitTwoPieceAttributes: filters.suitTwoPieceAttributes,
      });
      if (satisfiesPanelConstraints(panel, filters.panelConstraints)) {
        const suitCounts = new Map<string, number>();
        compactResult.relics.forEach((relic) => {
          const name = relic.suit?.name;
          if (name) suitCounts.set(name, (suitCounts.get(name) || 0) + 1);
        });
        compactTopResult = {
          score: metricValue(panel, metric),
          panel,
          relics: compactResult.relics,
          criticalRateOverflow: Math.max(0, panel.critRate - 100),
          suits: [...suitCounts.entries()]
            .filter(([, count]) => count >= 2)
            .sort((left, right) => right[1] - left[1])
            .map(([name, count]) => `${name}×${count}`),
        };
      }
    }
  }

  // 排序几千件御魂是主要耗时点。单件御魂在一次计算中的局部指标不变，
  // 因此先缓存分数，避免每次比较都重复计算。
  const localScoreCache = new Map<RelicView, number>();
  const getLocalScore = (relic: RelicView) => {
    const cached = localScoreCache.get(relic);
    if (cached !== undefined) return cached;
    const score = localScore(relic, metric, base);
    localScoreCache.set(relic, score);
    return score;
  };
  const eligibleRelics =
    calculationCache?.eligibleRelics ||
    prepareEligibleRelics(
      relicsByPosition,
      filters,
      POSITION_ORDER,
      getLocalScore,
    );
  if (calculationCache && !calculationCache.eligibleRelics) {
    calculationCache.eligibleRelics = eligibleRelics;
  }
  if (eligibleRelics.some((items) => items.length === 0)) return [];

  const requiredTwoPieceNames = [...(filters.requiredTwoPieceNames || [])];
  const requiredTwoPieceAttributes = [
    ...(filters.requiredTwoPieceAttributes || []),
  ];
  if (
    filters.requiredFourPiece &&
    requiredPieceCount === POSITION_ORDER.length &&
    requiredTwoPieceNames.length === 1 &&
    !requiredTwoPieceAttributes.length
  ) {
    return calculateFixedSuitLayouts(
      eligibleRelics,
      base,
      metric,
      filters,
      filters.requiredFourPiece,
      4,
      requiredTwoPieceNames,
      resultLimit,
      progress,
      undefined,
      compactTopResult ? [compactTopResult] : undefined,
    );
  }
  if (
    filters.requiredFourPiece &&
    requiredPieceCount === POSITION_ORDER.length &&
    requiredTwoPieceNames.length === 0 &&
    requiredTwoPieceAttributes.length === 1
  ) {
    const [twoPieceAttribute] = requiredTwoPieceAttributes;
    const matchingSuitNames = [...(filters.suitTwoPieceAttributes || [])]
      .filter(
        ([name, attribute]) =>
          name !== filters.requiredFourPiece && attribute === twoPieceAttribute,
      )
      .map(([name]) => name);

    if (!matchingSuitNames.length) return [];
    return calculateFixedSuitLayouts(
      eligibleRelics,
      base,
      metric,
      filters,
      filters.requiredFourPiece,
      4,
      matchingSuitNames,
      resultLimit,
      progress,
      undefined,
      compactTopResult ? [compactTopResult] : undefined,
    );
  }
  if (
    filters.requiredFourPiece &&
    requiredPieceCount === 4 &&
    !requiredTwoPieceAttributes.length
  ) {
    // 未指定两件套表示所有普通两件套都可用。无约束分支保留散件和不同套装的
    // 组合；逐套搜索则避免候选裁剪提前丢弃依赖两件套属性的高分组合。
    const normalTwoPieceNames = availableTwoPieceSuitNamesModule(
      eligibleRelics,
      [...(filters.suitTwoPieceAttributes || [])]
        .map(([name]) => name)
        .filter((name) => name !== filters.requiredFourPiece),
    );
    const unrestrictedPlan = createFixedSuitLayoutPlanModule(
      eligibleRelics,
      filters,
      filters.requiredFourPiece,
      4,
      undefined,
    );
    const explicitTwoPiecePlan = normalTwoPieceNames.length
      ? createFixedSuitLayoutPlanModule(
          eligibleRelics,
          filters,
          filters.requiredFourPiece,
          4,
          normalTwoPieceNames,
        )
      : undefined;
    const overallTotal =
      unrestrictedPlan.totalRelics + (explicitTwoPiecePlan?.totalRelics || 0);
    const reportPhaseProgress =
      (offset: number) => (value: CalculatorProgress) => {
        progress?.({
          ...value,
          processedRelics: Math.min(
            overallTotal,
            offset + value.processedRelics,
          ),
          totalRelics: overallTotal,
        });
      };
    // 未指定两件套与逐套覆盖搜索共享固定四件套候选。两阶段使用的是同一
    // 套件、号位和筛选输入，复用候选不会复用或修改任何计算结果。
    const sharedPatternCandidateCache =
      calculationCache?.fixedSuitCandidateCache || new Map();
    // 极速模式同样必须覆盖“剩余两件是散件或不同套装”的路径。之前直接
    // 从逐套两件套阶段开始，漏掉了这类真实组合，导致极速首条在多约束下
    // 可能与普通模式不同。第一阶段的最优解作为第二阶段安全上界，可以
    // 跳过不可能超过它的布局，同时不改变结果空间。
    if (filters.fastMode && normalTwoPieceNames.length) {
      if (fixedSuitPhase === "explicit") {
        return calculateFixedSuitLayouts(
          eligibleRelics,
          base,
          metric,
          filters,
          filters.requiredFourPiece,
          4,
          normalTwoPieceNames,
          resultLimit,
          progress,
          explicitTwoPiecePlan,
          initialResults,
          sharedPatternCandidateCache,
        );
      }
      if (fixedSuitPhase === "unrestricted") {
        return calculateFixedSuitLayouts(
          eligibleRelics,
          base,
          metric,
          filters,
          filters.requiredFourPiece,
          4,
          undefined,
          resultLimit,
          progress,
          unrestrictedPlan,
          initialResults,
          sharedPatternCandidateCache,
        );
      }
      // 先覆盖明确的两件套。这里很快就能得到一个真实可行的高分结果，
      // 再搜索散件/不同套装尾部路径时，可用这个结果作为严格下界进行
      // 上界剪枝；两个阶段仍都会执行，结果空间与普通模式相同。
      const explicitResults = calculateFixedSuitLayouts(
        eligibleRelics,
        base,
        metric,
        filters,
        filters.requiredFourPiece,
        4,
        normalTwoPieceNames,
        resultLimit,
        reportPhaseProgress(0),
        explicitTwoPiecePlan,
        initialResults,
        sharedPatternCandidateCache,
      );
      const unrestrictedResults = calculateFixedSuitLayouts(
        eligibleRelics,
        base,
        metric,
        filters,
        filters.requiredFourPiece,
        4,
        undefined,
        resultLimit,
        reportPhaseProgress(explicitTwoPiecePlan?.totalRelics || 0),
        unrestrictedPlan,
        explicitResults,
        sharedPatternCandidateCache,
      );
      return prioritizeCalculatorResults(
        [...unrestrictedResults, ...explicitResults],
        filters,
        metric,
        1,
      );
    }

    if (fixedSuitPhase === "unrestricted") {
      return calculateFixedSuitLayouts(
        eligibleRelics,
        base,
        metric,
        filters,
        filters.requiredFourPiece,
        4,
        undefined,
        resultLimit,
        progress,
        unrestrictedPlan,
        initialResults,
        sharedPatternCandidateCache,
      );
    }
    if (fixedSuitPhase === "explicit") {
      // 极速模式只需要未指定两件套阶段的最优结果。该阶段已经按实际
      // 套装计数处理两件套效果，继续逐套覆盖会把同一布局重复搜索一遍。
      if (filters.fastMode) return initialResults || [];
      const explicitResults = normalTwoPieceNames.length
        ? calculateFixedSuitLayouts(
            eligibleRelics,
            base,
            metric,
            filters,
            filters.requiredFourPiece,
            4,
            normalTwoPieceNames,
            resultLimit,
            progress,
            explicitTwoPiecePlan,
            initialResults,
            sharedPatternCandidateCache,
          )
        : [];
      return prioritizeCalculatorResults(
        [...(initialResults || []), ...explicitResults],
        filters,
        metric,
        resultLimit,
      );
    }
    /**
     * “任意两件套”会让剩余两个位置各自面对整仓库候选，是固定四件套中最重的
     * 分支。先搜索每个具体两件套，能够更早拿到真实组合的分数下界；随后执行
     * 任意两件套覆盖时，就可以安全跳过理论上也无法超过该下界的布局。
     *
     * 两个阶段都仍会完整执行，且最终仍统一去重、排序。这里只改变执行顺序，
     * 不删除散件、不同套装或任意一种两件套组合。
     */
    const unrestrictedResults = calculateFixedSuitLayouts(
      eligibleRelics,
      base,
      metric,
      filters,
      filters.requiredFourPiece,
      4,
      undefined,
      resultLimit,
      reportPhaseProgress(0),
      unrestrictedPlan,
      compactTopResult ? [compactTopResult] : undefined,
      sharedPatternCandidateCache,
    );
    const explicitTwoPieceResults = normalTwoPieceNames.length
      ? calculateFixedSuitLayouts(
          eligibleRelics,
          base,
          metric,
          filters,
          filters.requiredFourPiece,
          4,
          normalTwoPieceNames,
          resultLimit,
          reportPhaseProgress(unrestrictedPlan.totalRelics),
          explicitTwoPiecePlan,
          unrestrictedResults.length
            ? unrestrictedResults
            : compactTopResult
              ? [compactTopResult]
              : undefined,
          sharedPatternCandidateCache,
        )
      : [];
    return prioritizeCalculatorResults(
      [
        ...(compactTopResult ? [compactTopResult] : []),
        ...unrestrictedResults,
        ...explicitTwoPieceResults,
      ],
      filters,
      metric,
      resultLimit,
    );
  }
  if (
    !filters.requiredFourPiece &&
    requiredPieceCount === 2 &&
    requiredTwoPieceNames.length === 1 &&
    !requiredTwoPieceAttributes.length
  ) {
    return calculateFixedSuitLayouts(
      eligibleRelics,
      base,
      metric,
      filters,
      requiredTwoPieceNames[0],
      2,
      undefined,
      resultLimit,
      progress,
      undefined,
      compactGeneralTopResult ? [compactGeneralTopResult] : undefined,
    );
  }
  /**
   * 固定套装分支会在上方直接返回。通用候选池只服务于最后的通用 Beam 搜索，
   * 延迟到这里构造，避免固定四件套的大仓库计算白做一轮候选前沿整理。
   */
  const candidates = prepareGeneralCandidates(
    eligibleRelics,
    base,
    metric,
    filters,
    {
      positionCount: POSITION_ORDER.length,
      maxCandidatesPerPosition: candidateLimitForTotalRelics(
        eligibleRelics.reduce((total, items) => total + items.length, 0),
      ),
      requiredCandidateReserve: REQUIRED_CANDIDATE_RESERVE,
      compositeSlotSixCritDamageReserve: COMPOSITE_SLOT_SIX_CRIT_DAMAGE_RESERVE,
      requiredConstraintCandidateReserve: REQUIRED_CONSTRAINT_CANDIDATE_RESERVE,
      usesCriticalRateCap,
      criticalRateDiverseCandidates,
      panelFor,
      relicStatsFor,
      takeBest,
    },
  );
  if (candidates.some((items) => items.length === 0)) return [];
  return runGeneralBeamSearch(
    {
      candidates,
      base,
      metric,
      filters,
      resultLimit,
      progress,
      compactGeneralTopResult,
    },
    {
      constraintsForSearch: constraintsForSearchModule,
      panelConstraintProgress: panelConstraintProgressModule,
      panelConstraintBucketSignature: panelConstraintBucketSignatureModule,
      requirementSignature: requirementSignatureModule,
      prioritizeResults: prioritizeCalculatorResults,
      relicsForState: relicsForStateModule,
      createEmptyStatBag,
      parseTwoPieceAttribute,
      criticalRateOverflow,
      criticalRateBucket,
      hasFullCriticalRateConstraint,
      usesCriticalRateCap,
      resultForState,
      metricValue,
      panelFor,
      addAttribute,
      addRelic,
      relicStatsFor,
      takeBest,
      beamWidth: BEAM_WIDTH,
      requirementBeamWidth: REQUIREMENT_BEAM_WIDTH,
      fullCritBucketWidth: FULL_CRIT_BUCKET_WIDTH,
      fastBeamWidth: FAST_BEAM_WIDTH,
      fastRequirementBeamWidth: FAST_REQUIREMENT_BEAM_WIDTH,
      fastFullCritBucketWidth: FAST_FULL_CRIT_BUCKET_WIDTH,
    },
  );
}

/**
 * 请求对象形式的组合搜索入口，适合 Worker、后续页面功能和独立脚本直接调用。
 * 该函数不读取浏览器状态，也不会修改传入的数据。
 */
export function calculateRelicCombinationsForRequest(
  request: RelicCalculationRequest,
  progress?: (value: CalculatorProgress) => void,
  calculationCache?: RelicCalculationCache,
) {
  return calculateRelicCombinations(
    request.relicsByPosition,
    request.baseStats,
    request.metric,
    request.filters,
    request.resultLimit,
    progress,
    request.fixedSuitPhase,
    request.initialResults,
    calculationCache,
  );
}

export function calculatorAttributeOptions(
  relicsByPosition: Record<string, RelicView[]>,
) {
  return [2, 4, 6].reduce<Record<number, { label: string; value: string }[]>>(
    (result, position) => {
      result[position] = [
        ...new Set(
          (relicsByPosition[String(position)] || [])
            .map((relic) => relic.mainAttribute?.label)
            .filter((label): label is string => Boolean(label)),
        ),
      ].map((label) => ({ label, value: label }));
      return result;
    },
    {},
  );
}
