import type { RelicView } from "../types";
import type {
  CalculatorFilters,
  CalculatorMetric,
  HeroBaseStats,
} from "./calculator/types";
export type {
  FastFixedSuitSearchInput,
  FastFixedSuitSearchResult,
} from "./calculator/fastTypes";
import {
  addVector,
  emptyVector,
  maximumVector,
  relicToFastVector,
  sumVectors,
  sumThreeVectors,
  twoPieceToFastVector,
  minimumVectorForNode,
  vectorForNode,
} from "./calculator/fastVector";

const relicVector = relicToFastVector;
const twoPieceVector = twoPieceToFastVector;
import {
  fastCanReachConstraints,
  fastCanStillSatisfyConstraints,
  fastMetricDimensions,
  fastMetricValue,
  fastSearchDimensions,
  fastSatisfiesConstraints,
  fastUpperPanelForVector,
  panelForVector,
} from "./calculator/fastPanel";
import {
  buildFastPairCandidates,
  buildFastPairFrontier,
  buildFastQuadFrontier,
  countFastSuits,
  fastPairBonus,
} from "./calculator/fastPairs";
import { dominatesOnDimensions } from "./calculator/paretoPrimitives";
import { paretoFrontier3D as paretoFrontier3DImpl } from "./calculator/pareto3d";
import { paretoFrontier4D as paretoFrontier4DImpl } from "./calculator/pareto4d";
import { paretoFrontier5D as paretoFrontier5DImpl } from "./calculator/pareto5d";
import { buildPairSearchTree } from "./calculator/pairSearchTree";
import { buildFourDimensionIndex as buildFourDimensionIndexImpl } from "./calculator/fourDimensionIndex";
import {
  fastRelicPriority,
  fixedFourPiecePatterns as fixedFourPiecePatternsImpl,
  isFastRelicEligible,
  removeFastDominated,
  removeFastDominatedSameSuit,
  paretoFrontierWithExactDimensions,
} from "./calculator/fastPreparation";
import {
  genericRequirementsCanStillBeMet as genericRequirementsCanStillBeMetImpl,
  genericSetRequirementsSatisfied as genericSetRequirementsSatisfiedImpl,
  genericUpperVector as genericUpperVectorImpl,
  possibleBonusUpperVector as possibleBonusUpperVectorImpl,
} from "./calculator/fastRequirements";
import {
  buildMetricSuffixFrontiers,
  calculateMetricUpperBound,
} from "./calculator/fastMetricBounds";
import {
  calculateFastFixedSuitSearch as calculateFastFixedSuitSearchModule,
  type FastFixedSuitSearchDependencies,
} from "./calculator/fastFixedSuitSearch";

const metricValue = fastMetricValue;
const metricDimensions = fastMetricDimensions;
const searchDimensions = fastSearchDimensions;
const satisfiesConstraints = fastSatisfiesConstraints;
const upperPanelForVector = fastUpperPanelForVector;
const canReachConstraints = fastCanReachConstraints;
const canStillSatisfyConstraints = fastCanStillSatisfyConstraints;
const buildPairCandidates = buildFastPairCandidates;
const buildPairFrontier = buildFastPairFrontier;
const buildQuadFrontier = buildFastQuadFrontier;
const pairBonus = fastPairBonus;
const suitsFor = countFastSuits;
const fixedFourPiecePatterns = fixedFourPiecePatternsImpl;
const isEligible = isFastRelicEligible;
const priority = fastRelicPriority;
const genericSetRequirementsSatisfied = genericSetRequirementsSatisfiedImpl;
const genericRequirementsCanStillBeMet = genericRequirementsCanStillBeMetImpl;
const genericUpperVector = genericUpperVectorImpl;
const possibleBonusUpperVector = possibleBonusUpperVectorImpl;

/**
 * 极速固定套装搜索的兼容入口。
 * 具体搜索放在 calculator/fastFixedSuitSearch.ts，这里只组装已经验证过的算法依赖。
 */
export function calculateFastFixedSuitSearch(
  input: FastFixedSuitSearchInput,
): FastFixedSuitSearchResult[] {
  const dependencies: FastFixedSuitSearchDependencies = {
    positionCount: POSITION_COUNT,
    epsilon: EPSILON,
    emptyVector,
    addVector,
    maximumVector,
    sumVectors,
    relicVector,
    twoPieceVector,
    isEligible,
    vectorForNode,
    minimumVectorForNode,
    searchDimensions,
    metricValue,
    panelForVector,
    satisfiesConstraints,
    canReachConstraints,
    canStillSatisfyConstraints,
    removeDominated,
    removeDominatedSameSuit,
    fixedFourPiecePatterns,
    buildPairCandidates,
    buildPairFrontier,
    buildQuadFrontier,
    buildPairSearchTree,
    paretoFrontier,
    paretoFrontierWithExactDimensions: (
      values,
      dominanceDimensions,
      exactDimensions,
    ) =>
      paretoFrontierWithExactDimensions(
        values,
        dominanceDimensions,
        exactDimensions,
        paretoFrontier,
      ),
    countFastSuits: suitsFor,
    priority,
    genericRequirementsCanStillBeMet,
    genericSetRequirementsSatisfied,
    genericUpperVector,
    possibleBonusUpperVector,
    buildMetricSuffixFrontiers,
    calculateMetricUpperBound,
    upperPanelForVector,
  };
  return calculateFastFixedSuitSearchModule(input, dependencies);
}
function paretoFrontier3D<T extends FastVector>(
  pairs: T[],
  dimensions: readonly [FastDimension, FastDimension, FastDimension],
): T[] {
  return paretoFrontier3DImpl(pairs, dimensions);
}
function paretoFrontier4D<T extends FastVector>(
  pairs: T[],
  dimensions: readonly [
    FastDimension,
    FastDimension,
    FastDimension,
    FastDimension,
  ],
): T[] {
  return paretoFrontier4DImpl(pairs, dimensions);
}
function paretoFrontier5D<T extends FastVector>(
  pairs: T[],
  dimensions: readonly [
    FastDimension,
    FastDimension,
    FastDimension,
    FastDimension,
    FastDimension,
  ],
): T[] {
  return paretoFrontier5DImpl(
    pairs,
    dimensions,
    buildFourDimensionIndexImpl,
    paretoFrontier4D,
  );
}
import {
  FAST_DIMENSIONS,
  type FastDimension,
  type FastFixedSuitSearchInput,
  type FastFixedSuitSearchResult,
  type FastRelic,
  type FastVector,
  type PairCandidate,
  type PairSearchTree,
  type QuadCandidate,
} from "./calculator/fastTypes";

/**
 * 固定四件套伤害搜索的大部分时间都消耗在束搜索中携带展示对象。
 * 这个模块只保留影响“攻击 × 爆伤”指标的四个数值和御魂索引。
 *
 * 这里不会把不同御魂的独立属性最大值拼成虚假组合，每个评分仍然来自一套真实的六件御魂。
 * 两个自由位置通过笛卡尔积树搜索，树节点只保存乐观上界，叶节点评分前始终应用真实的两件套规则。
 */

const POSITION_COUNT = 6;
const EPSILON = 1e-9;

function paretoFrontier<T extends FastVector>(
  pairs: T[],
  dimensions: readonly FastDimension[],
) {
  if (pairs.length < 2) return pairs;
  // 有效维度达到六个或更多时，精确天际线可能比组合搜索本身更大、更昂贵。
  // 保留每个真实向量仍然是精确的；下面的分支限界搜索使用逐维最大值，
  // 每个叶节点都会执行标准约束和评分检查。这是有意保留候选，不是近似计算。
  if (dimensions.length > 5) return pairs;
  if (dimensions.length === 1) {
    const [dimension] = dimensions;
    const best = Math.max(...pairs.map((pair) => pair[dimension]));
    return pairs
      .filter((pair) => pair[dimension] >= best - EPSILON)
      .slice(0, 1);
  }
  if (dimensions.length === 2) {
    const [primary, secondary] = dimensions;
    const ordered = pairs
      .map((pair, index) => ({ pair, index }))
      .sort(
        (left, right) =>
          right.pair[primary] - left.pair[primary] ||
          right.pair[secondary] - left.pair[secondary] ||
          left.index - right.index,
      );
    let maximumSecondary = Number.NEGATIVE_INFINITY;
    return ordered
      .filter(({ pair }) => {
        if (pair[secondary] <= maximumSecondary + EPSILON) return false;
        maximumSecondary = pair[secondary];
        return true;
      })
      .map(({ pair }) => pair);
  }
  if (dimensions.length === 3) {
    return paretoFrontier3D(
      pairs,
      dimensions as [FastDimension, FastDimension, FastDimension],
    );
  }
  if (dimensions.length === 4) {
    return paretoFrontier4D(
      pairs,
      dimensions as [
        FastDimension,
        FastDimension,
        FastDimension,
        FastDimension,
      ],
    );
  }
  if (dimensions.length === 5) {
    return paretoFrontier5D(
      pairs,
      dimensions as [
        FastDimension,
        FastDimension,
        FastDimension,
        FastDimension,
        FastDimension,
      ],
    );
  }

  // 大多数非伤害指标有三或四个有效维度。单件御魂前沿会把列表缩小到适合精确增量前沿的规模；
  // 和束搜索不同，这里不会依据标量近似值丢弃候选。
  const ordered = [...pairs].sort((left, right) => {
    for (const key of dimensions) {
      const difference = right[key] - left[key];
      if (Math.abs(difference) > EPSILON) return difference;
    }
    return 0;
  });
  const frontier: T[] = [];
  ordered.forEach((candidate) => {
    if (
      frontier.some((existing) =>
        dominatesOnDimensions(existing, candidate, dimensions),
      )
    )
      return;
    for (let index = frontier.length - 1; index >= 0; index -= 1) {
      if (dominatesOnDimensions(candidate, frontier[index], dimensions)) {
        frontier.splice(index, 1);
      }
    }
    frontier.push(candidate);
  });
  return frontier;
}

function removeDominated(
  relics: FastRelic[],
  dimensions: readonly FastDimension[] = FAST_DIMENSIONS,
) {
  return removeFastDominated(relics, dimensions, paretoFrontier);
}

function removeDominatedSameSuit(
  relics: FastRelic[],
  dimensions: readonly FastDimension[] = FAST_DIMENSIONS,
) {
  return removeFastDominatedSameSuit(relics, dimensions, paretoFrontier);
}

/**
 * 紧凑路径对固定的普通四件套布局保持精确，支持所有指标和所有下限约束；
 * 上限约束仍然走标准路径，因为上限会改变安全支配的方向。
 */
export function canUseFastFixedSuitSearch(
  filters: CalculatorFilters,
  metric: string,
  resultLimit: number,
  baseStats: HeroBaseStats,
  fixedSuitPhase?: "unrestricted" | "explicit",
) {
  if (resultLimit < 1) return false;
  if (!filters.requiredFourPiece || fixedSuitPhase === "explicit") return false;
  if (
    (filters.requiredTwoPieceNames?.size || 0) +
      (filters.requiredTwoPieceAttributes?.size || 0) >
    1
  )
    return false;
  if (
    filters.requiredTwoPieceAttributes?.size === 1 &&
    !filters.suitTwoPieceAttributes
  )
    return false;
  const constraints = filters.panelConstraints || {};
  const activeConstraintKeys = Object.entries(constraints)
    .filter(([key, range]) => {
      const baseValue = baseStats[key as keyof HeroBaseStats] || 0;
      return (
        range?.max !== undefined ||
        (range?.min !== undefined && range.min > baseValue)
      );
    })
    .map(([key]) => key);
  // 带上限的固定套紧凑搜索仍在与标准搜索进行差分校验。结果正确性优先，
  // 在校验覆盖完整前继续使用已验证的标准固定套路径。
  if (Object.values(constraints).some((range) => range?.max !== undefined))
    return false;
  return activeConstraintKeys.every((key) =>
    [
      "attack",
      "health",
      "defense",
      "speed",
      "critRate",
      "critDamage",
      "effectHit",
      "effectResistance",
    ].includes(key),
  );
}

/**
 * 通用紧凑搜索不假设存在四件套布局，而是覆盖六个位置的精确分支限界搜索，
 * 包括 2+2+2、指定两件套、一件套和面板上限。只有当同套装或同一件套行为的另一个御魂，
 * 在所有可能提升目标结果的维度上都不差时，才会删除当前候选。
 */
export function canUseFastGeneralSearch(
  filters: CalculatorFilters,
  resultLimit: number,
  fixedSuitPhase?: "unrestricted" | "explicit",
) {
  return Boolean(resultLimit >= 1 && fixedSuitPhase !== "explicit");
}

export function inspectFastGeneralCandidates(
  relicsByPosition: Record<string, RelicView[]>,
  baseStats: HeroBaseStats,
  metric: CalculatorMetric,
  filters: CalculatorFilters,
) {
  const dimensions = searchDimensions(
    baseStats,
    metric,
    filters.panelConstraints,
  );
  const dominanceDimensions = dimensions.filter(
    (dimension) => filters.panelConstraints?.[dimension]?.max === undefined,
  );
  const exactConstraintDimensions = FAST_DIMENSIONS.filter(
    (dimension) => filters.panelConstraints?.[dimension]?.max !== undefined,
  );
  return Array.from({ length: POSITION_COUNT }, (_item, index) => {
    const eligible = (relicsByPosition[String(index + 1)] || [])
      .filter((relic) => isEligible(relic, index + 1, filters))
      .map((relic) => relicVector(relic, baseStats));
    const frontier = exactSameSuitFrontier(
      eligible,
      dominanceDimensions,
      exactConstraintDimensions,
    );
    return { eligible: eligible.length, frontier: frontier.length };
  });
}

export function inspectFastGeneralSuffixFrontiers(
  relicsByPosition: Record<string, RelicView[]>,
  baseStats: HeroBaseStats,
  metric: CalculatorMetric,
  filters: CalculatorFilters,
) {
  const dimensions = searchDimensions(
    baseStats,
    metric,
    filters.panelConstraints,
  );
  const dominanceDimensions = dimensions.filter(
    (dimension) => filters.panelConstraints?.[dimension]?.max === undefined,
  );
  const exactConstraintDimensions = FAST_DIMENSIONS.filter(
    (dimension) => filters.panelConstraints?.[dimension]?.max !== undefined,
  );
  const candidates = Array.from({ length: POSITION_COUNT }, (_item, index) =>
    exactSameSuitFrontier(
      (relicsByPosition[String(index + 1)] || [])
        .filter((relic) => isEligible(relic, index + 1, filters))
        .map((relic) => relicVector(relic, baseStats)),
      dominanceDimensions,
      exactConstraintDimensions,
    ),
  );
  const suffixes: FastVector[][] = Array.from(
    { length: POSITION_COUNT + 1 },
    () => [emptyVector()],
  );
  for (let position = POSITION_COUNT - 1; position >= 0; position -= 1) {
    const combinations: FastVector[] = [];
    candidates[position].forEach((left) =>
      suffixes[position + 1].forEach((right) =>
        combinations.push(sumVectors(left, right)),
      ),
    );
    suffixes[position] = paretoFrontier(combinations, dominanceDimensions);
  }
  return { dimensions, sizes: suffixes.map((items) => items.length) };
}

function exactSameSuitFrontier(
  relics: FastRelic[],
  dimensions: readonly FastDimension[],
  exactDimensions: readonly FastDimension[] = [],
) {
  const groups = new Map<string, FastRelic[]>();
  relics.forEach((relic) => {
    const exactKey = exactDimensions
      .map((dimension) => `${dimension}=${relic[dimension]}`)
      .join("|");
    const key = `${relic.suit}|${relic.hasOnePieceBonus ? "one" : "normal"}|${exactKey}`;
    const group = groups.get(key);
    if (group) group.push(relic);
    else groups.set(key, [relic]);
  });
  return [...groups.values()].flatMap((group) =>
    paretoFrontier(group, dimensions),
  );
}

function genericPriority(
  relic: FastVector,
  base: HeroBaseStats,
  metric: CalculatorMetric,
  constraints: CalculatorFilters["panelConstraints"],
) {
  const panel = panelForVector(base, relic);
  let value = metricValue(panel, metric);
  Object.entries(constraints || {}).forEach(([rawKey, range]) => {
    const key = rawKey as keyof typeof panel;
    if (range?.min !== undefined) {
      value +=
        10_000 *
        Math.min(2, Math.max(0, panel[key] / Math.max(1, Math.abs(range.min))));
    }
    if (range?.max !== undefined) {
      value -= Math.max(0, panel[key] - range.max) * 10_000;
    }
  });
  return value;
}

function legacyPossibleBonusUpperVector(
  twoPieceBySuit: ReadonlyMap<string, FastVector>,
  counts: ReadonlyMap<string, number>,
  activatedBonusSuits: ReadonlySet<string>,
  remaining: readonly FastRelic[][],
  remainingSuitCounts?: ReadonlyMap<string, number>,
) {
  const upper = emptyVector();
  const possibleBonusCount = Math.max(0, 3 - activatedBonusSuits.size);
  if (!possibleBonusCount) return upper;

  // 把全局最大套装加成乘以三虽然安全，但上界非常宽松：即使某套装在剩余位置无法出现两件，
  // 也会让对应分支继续存在。这里仅使用仍可能激活的套装，逐维构造上界，
  // 同时允许不同维度选择不同套装。这个上界仍然乐观，但会紧得多。
  const possibleBonuses: FastVector[] = [];
  twoPieceBySuit.forEach((bonus, suit) => {
    if (activatedBonusSuits.has(suit)) return;
    const possibleCount =
      (counts.get(suit) || 0) +
      (remainingSuitCounts
        ? remainingSuitCounts.get(suit) || 0
        : remaining.reduce(
            (total, candidates) =>
              total + Number(candidates.some((relic) => relic.suit === suit)),
            0,
          ));
    if (possibleCount >= 2) possibleBonuses.push(bonus);
  });
  const addTop = (dimension: FastDimension) => {
    const values = possibleBonuses
      .map((bonus) => bonus[dimension])
      .sort((left, right) => right - left);
    const count = Math.min(possibleBonusCount, values.length);
    for (let index = 0; index < count; index += 1)
      upper[dimension] += values[index];
  };
  FAST_DIMENSIONS.forEach(addTop);
  return upper;
}

export function calculateFastGeneralSearch(
  input: FastFixedSuitSearchInput,
): FastFixedSuitSearchResult[] {
  return calculateFastGeneralSearchRecursive(input);
}

function calculateFastGeneralSearchRecursive({
  relicsByPosition,
  baseStats,
  metric,
  filters,
  resultLimit = 1,
  onProgress,
}: FastFixedSuitSearchInput): FastFixedSuitSearchResult[] {
  const dimensions = searchDimensions(
    baseStats,
    metric,
    filters.panelConstraints,
  );
  const dominanceDimensions = dimensions.filter(
    (dimension) => filters.panelConstraints?.[dimension]?.max === undefined,
  );
  const exactConstraintDimensions = FAST_DIMENSIONS.filter(
    (dimension) => filters.panelConstraints?.[dimension]?.max !== undefined,
  );
  const eligible = Array.from({ length: POSITION_COUNT }, (_item, index) =>
    (relicsByPosition[String(index + 1)] || [])
      .filter((relic) => isEligible(relic, index + 1, filters))
      .map((relic) => relicVector(relic, baseStats)),
  );
  if (eligible.some((items) => items.length === 0)) return [];

  const candidates = eligible.map((items) =>
    exactSameSuitFrontier(
      items,
      dominanceDimensions,
      exactConstraintDimensions,
    ).sort(
      (left, right) =>
        genericPriority(right, baseStats, metric, filters.panelConstraints) -
        genericPriority(left, baseStats, metric, filters.panelConstraints),
    ),
  );
  if (candidates.some((items) => items.length === 0)) return [];

  const twoPieceBySuit = new Map<string, FastVector>();
  filters.suitTwoPieceAttributes?.forEach((attribute, suit) => {
    twoPieceBySuit.set(suit, twoPieceVector(attribute, baseStats));
  });
  const limit = Math.max(1, Math.floor(resultLimit));
  const bestResults: FastFixedSuitSearchResult[] = [];
  const bestThreshold = () =>
    bestResults.length >= limit
      ? bestResults[bestResults.length - 1].score
      : Number.NEGATIVE_INFINITY;
  const masks = filters.requiredFourPiece
    ? fixedFourPiecePatterns(filters.fixedPatternIndexes)
    : [undefined];
  const totalTasks = Math.max(1, masks.length);
  let processedTasks = 0;

  const accept = (relics: RelicView[], vector: FastVector) => {
    if (!genericSetRequirementsSatisfied(relics, filters)) return false;
    const panel = panelForVector(baseStats, vector);
    if (!satisfiesConstraints(panel, filters.panelConstraints)) return false;
    const score = metricValue(panel, metric);
    const orderedRelics = relics
      .slice()
      .sort((left, right) => (left.position || 0) - (right.position || 0));
    bestResults.push({
      relics: orderedRelics,
      score,
      criticalRateOverflow: Math.max(0, panel.critRate - 100),
    });
    bestResults.sort(
      (left, right) =>
        right.score - left.score ||
        left.criticalRateOverflow - right.criticalRateOverflow,
    );
    if (bestResults.length > limit) bestResults.length = limit;
    return true;
  };

  masks.forEach((mask) => {
    const hasOnePieceRelic = eligible.some((items) =>
      items.some((relic) => relic.hasOnePieceBonus),
    );
    const searchPositions =
      mask || hasOnePieceRelic
        ? [0, 1, 2, 3, 4, 5]
        : [0, 1, 2, 3, 4, 5].sort(
            (left, right) => candidates[left].length - candidates[right].length,
          );
    const options = searchPositions.map((position) =>
      mask && mask[position]
        ? candidates[position].filter(
            (relic) => relic.suit === filters.requiredFourPiece,
          )
        : candidates[position],
    );
    if (options.some((items) => items.length === 0)) {
      processedTasks += 1;
      onProgress?.(processedTasks, totalTasks);
      return;
    }
    const suffixMaximums: FastVector[] = new Array(POSITION_COUNT + 1);
    suffixMaximums[POSITION_COUNT] = emptyVector();
    for (let position = POSITION_COUNT - 1; position >= 0; position -= 1) {
      const positionMaximum = options[position].reduce(
        (maximum, relic) => maximumVector(maximum, relic),
        emptyVector(),
      );
      suffixMaximums[position] = sumVectors(
        positionMaximum,
        suffixMaximums[position + 1],
      );
    }
    const remainingSuitCounts: Map<string, number>[] = Array.from(
      { length: POSITION_COUNT + 1 },
      () => new Map<string, number>(),
    );
    for (let position = POSITION_COUNT - 1; position >= 0; position -= 1) {
      remainingSuitCounts[position] = new Map(
        remainingSuitCounts[position + 1],
      );
      const suitsAtPosition = new Set(
        options[position]
          .map((relic) => relic.suit)
          .filter((suit): suit is string => Boolean(suit)),
      );
      suitsAtPosition.forEach((suit) => {
        remainingSuitCounts[position].set(
          suit,
          (remainingSuitCounts[position].get(suit) || 0) + 1,
        );
      });
    }
    const metricFrontiers = buildMetricSuffixFrontiers(
      options,
      metric,
      metricDimensions,
      paretoFrontier,
    );
    type SeedState = {
      vector: FastVector;
      counts: Map<string, number>;
      activatedBonusSuits: Set<string>;
      relics: RelicView[];
    };
    const seedRank = (state: SeedState, position: number) => {
      const remaining = options.slice(position + 1);
      const optimistic = genericUpperVector(
        state.vector,
        suffixMaximums[position + 1],
        twoPieceBySuit,
        state.counts,
        state.activatedBonusSuits,
        remaining,
        remainingSuitCounts[position + 1],
      );
      const panel = upperPanelForVector(
        baseStats,
        optimistic,
        filters.panelConstraints,
      );
      let value = metricValue(panel, metric) * 1_000;
      Object.entries(filters.panelConstraints || {}).forEach(
        ([rawKey, range]) => {
          const key = rawKey as keyof ReturnType<typeof panelForVector>;
          if (range?.min !== undefined)
            value +=
              10_000_000 * Math.min(1, panel[key] / Math.max(1, range.min));
          if (range?.max !== undefined)
            value -= Math.max(0, panel[key] - range.max) * 10_000;
        },
      );
      if (filters.requiredFourPiece)
        value +=
          ((state.counts.get(filters.requiredFourPiece) || 0) / 4) * 1_000_000;
      for (const name of filters.requiredTwoPieceNames || [])
        value += (Math.min(2, state.counts.get(name) || 0) / 2) * 1_000_000;
      return value;
    };
    let seedBeam: SeedState[] = [
      {
        vector: emptyVector(),
        counts: new Map(),
        activatedBonusSuits: new Set(),
        relics: [],
      },
    ];
    for (let position = 0; position < POSITION_COUNT; position += 1) {
      const next: SeedState[] = [];
      seedBeam.forEach((state) =>
        options[position].forEach((relic) => {
          const vector = sumVectors(state.vector, relic);
          const counts = new Map(state.counts);
          const activatedBonusSuits = new Set(state.activatedBonusSuits);
          if (relic.suit) {
            const count = (counts.get(relic.suit) || 0) + 1;
            counts.set(relic.suit, count);
            if (
              count === 2 &&
              !relic.hasOnePieceBonus &&
              twoPieceBySuit.has(relic.suit)
            ) {
              addVector(vector, twoPieceBySuit.get(relic.suit)!);
              activatedBonusSuits.add(relic.suit);
            }
          }
          if (
            !genericRequirementsCanStillBeMet(
              counts,
              filters,
              options.slice(position + 1),
              remainingSuitCounts[position + 1],
            )
          )
            return;
          const currentPanel = panelForVector(baseStats, vector);
          const upperVector = genericUpperVector(
            vector,
            suffixMaximums[position + 1],
            twoPieceBySuit,
            counts,
            activatedBonusSuits,
            options.slice(position + 1),
            remainingSuitCounts[position + 1],
          );
          const upperPanel = upperPanelForVector(
            baseStats,
            upperVector,
            filters.panelConstraints,
          );
          if (
            !canStillSatisfyConstraints(
              currentPanel,
              upperPanel,
              filters.panelConstraints,
            )
          )
            return;
          next.push({
            vector,
            counts,
            activatedBonusSuits,
            relics: [...state.relics, relic.relic],
          });
        }),
      );
      next.sort(
        (left, right) => seedRank(right, position) - seedRank(left, position),
      );
      seedBeam = next.slice(0, 96);
      if (!seedBeam.length) break;
    }
    const seed = seedBeam.find((state) => {
      const panel = panelForVector(baseStats, state.vector);
      return (
        genericSetRequirementsSatisfied(state.relics, filters) &&
        satisfiesConstraints(panel, filters.panelConstraints)
      );
    });
    const chosen = new Array<RelicView | undefined>(POSITION_COUNT).fill(
      undefined,
    );
    if (seed) accept(seed.relics, seed.vector);
    let seedOnly = !seed;
    let seedBudget = 250_000;
    let seedAborted = false;
    const visit = (
      position: number,
      vector: FastVector,
      counts: Map<string, number>,
      activatedBonusSuits: Set<string>,
    ): boolean => {
      if (seedOnly && seedAborted) return false;
      const remaining = options.slice(position);
      const optimistic = genericUpperVector(
        vector,
        suffixMaximums[position],
        twoPieceBySuit,
        counts,
        activatedBonusSuits,
        remaining,
        remainingSuitCounts[position],
      );
      const currentPanel = panelForVector(baseStats, vector);
      const upperPanel = upperPanelForVector(
        baseStats,
        optimistic,
        filters.panelConstraints,
      );
      if (
        !canStillSatisfyConstraints(
          currentPanel,
          upperPanel,
          filters.panelConstraints,
        )
      )
        return false;
      const bonusUpper = possibleBonusUpperVector(
        twoPieceBySuit,
        counts,
        activatedBonusSuits,
        remaining,
        remainingSuitCounts[position],
      );
      if (
        calculateMetricUpperBound(
          baseStats,
          vector,
          metricFrontiers.suffixes[position],
          metric,
          bonusUpper,
          panelForVector,
          metricValue,
        ) <
        bestThreshold() - EPSILON
      )
        return false;
      if (
        !genericRequirementsCanStillBeMet(
          counts,
          filters,
          remaining,
          remainingSuitCounts[position],
        )
      )
        return false;
      if (position === POSITION_COUNT) {
        const accepted = accept(chosen as RelicView[], vector);
        return seedOnly && accepted;
      }
      for (const relic of options[position]) {
        if (seedOnly) {
          if (seedBudget <= 0) {
            seedAborted = true;
            break;
          }
          seedBudget -= 1;
        }
        const nextVector = sumVectors(vector, relic);
        const nextCounts = new Map(counts);
        const nextActivated = new Set(activatedBonusSuits);
        if (relic.suit) {
          const nextCount = (nextCounts.get(relic.suit) || 0) + 1;
          nextCounts.set(relic.suit, nextCount);
          if (
            nextCount === 2 &&
            !relic.hasOnePieceBonus &&
            twoPieceBySuit.has(relic.suit)
          ) {
            addVector(nextVector, twoPieceBySuit.get(relic.suit)!);
            nextActivated.add(relic.suit);
          }
        }
        chosen[searchPositions[position]] = relic.relic;
        if (visit(position + 1, nextVector, nextCounts, nextActivated))
          return true;
      }
      chosen[searchPositions[position]] = undefined;
      return false;
    };
    visit(0, emptyVector(), new Map(), new Set());
    seedOnly = false;
    seedAborted = false;
    visit(0, emptyVector(), new Map(), new Set());
    processedTasks += 1;
    onProgress?.(processedTasks, totalTasks);
  });
  return bestResults;
}
