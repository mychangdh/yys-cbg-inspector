import type { RelicView } from "@/types";
import type {
  CalculatorFilters,
  CalculatorMetric,
  HeroBaseStats,
} from "./types";
import type {
  FastDimension,
  FastFixedSuitSearchInput,
  FastFixedSuitSearchResult,
  FastRelic,
  FastVector,
  PairCandidate,
  PairSearchTree,
} from "./fastTypes";

export interface FastFixedSuitSearchDependencies {
  positionCount: number;
  epsilon: number;
  emptyVector: () => FastVector;
  addVector: (target: FastVector, source: FastVector) => void;
  maximumVector: (left: FastVector, right: FastVector) => FastVector;
  sumVectors: (...vectors: FastVector[]) => FastVector;
  relicVector: (relic: RelicView, base: HeroBaseStats) => FastRelic;
  twoPieceVector: (attribute: string, base: HeroBaseStats) => FastVector;
  isEligible: (
    relic: RelicView,
    position: number,
    filters: CalculatorFilters,
  ) => boolean;
  vectorForNode: (node: PairSearchTree["nodes"][number]) => FastVector;
  minimumVectorForNode: (node: PairSearchTree["nodes"][number]) => FastVector;
  searchDimensions: (
    base: HeroBaseStats,
    metric: CalculatorMetric,
    constraints: CalculatorFilters["panelConstraints"],
  ) => readonly FastDimension[];
  metricValue: (
    panel: ReturnType<typeof import("./fastPanel").panelForVector>,
    metric: CalculatorMetric,
  ) => number;
  panelForVector: typeof import("./fastPanel").panelForVector;
  satisfiesConstraints: typeof import("./fastPanel").fastSatisfiesConstraints;
  canReachConstraints: typeof import("./fastPanel").fastCanReachConstraints;
  removeDominated: (
    relics: FastRelic[],
    dimensions: readonly FastDimension[],
  ) => FastRelic[];
  removeDominatedSameSuit: (
    relics: FastRelic[],
    dimensions: readonly FastDimension[],
  ) => FastRelic[];
  fixedFourPiecePatterns: (indexes?: number[]) => boolean[][];
  buildPairCandidates: typeof import("./fastPairs").buildFastPairCandidates;
  buildPairFrontier: typeof import("./fastPairs").buildFastPairFrontier;
  buildQuadFrontier: typeof import("./fastPairs").buildFastQuadFrontier;
  buildPairSearchTree: typeof import("./pairSearchTree").buildPairSearchTree;
  paretoFrontier: <T extends FastVector>(
    values: T[],
    dimensions: readonly FastDimension[],
  ) => T[];
  paretoFrontierWithExactDimensions: <T extends FastVector>(
    values: readonly T[],
    dominanceDimensions: readonly FastDimension[],
    exactDimensions: readonly FastDimension[],
  ) => T[];
  countFastSuits: typeof import("./fastPairs").countFastSuits;
  priority: (relic: FastRelic, base: HeroBaseStats) => number;
  genericRequirementsCanStillBeMet: typeof import("./fastRequirements").genericRequirementsCanStillBeMet;
  genericSetRequirementsSatisfied: typeof import("./fastRequirements").genericSetRequirementsSatisfied;
  genericUpperVector: typeof import("./fastRequirements").genericUpperVector;
  possibleBonusUpperVector: typeof import("./fastRequirements").possibleBonusUpperVector;
  buildMetricSuffixFrontiers: typeof import("./fastMetricBounds").buildMetricSuffixFrontiers;
  calculateMetricUpperBound: typeof import("./fastMetricBounds").calculateMetricUpperBound;
  upperPanelForVector: typeof import("./fastPanel").fastUpperPanelForVector;
  canStillSatisfyConstraints: typeof import("./fastPanel").fastCanStillSatisfyConstraints;
}

export function calculateFastFixedSuitSearch(
  input: FastFixedSuitSearchInput,
  deps: FastFixedSuitSearchDependencies,
): FastFixedSuitSearchResult[] {
  const {
    relicsByPosition,
    baseStats,
    metric,
    filters,
    resultLimit = 1,
    onProgress,
  } = input;
  const fixedSuit = filters.requiredFourPiece;
  if (!fixedSuit) return [];
  const dimensions = deps.searchDimensions(
    baseStats,
    metric,
    filters.panelConstraints,
  );
  // 带上限的属性不能按“越高越好”参与支配比较。将其作为精确分组键，
  // 只在相同上限属性值内淘汰被覆盖候选，保证攻击上限等条件不会丢解。
  const exactConstraintDimensions = dimensions.filter(
    (dimension) => filters.panelConstraints?.[dimension]?.max !== undefined,
  );
  const dominanceDimensions = dimensions.filter(
    (dimension) => !exactConstraintDimensions.includes(dimension),
  );
  const constrainedFrontier = <T extends FastVector>(values: readonly T[]) =>
    deps.paretoFrontierWithExactDimensions(
      values,
      dominanceDimensions,
      exactConstraintDimensions,
    );

  const eligible = Array.from({ length: deps.positionCount }, (_item, index) =>
    (relicsByPosition[String(index + 1)] || [])
      .filter((relic) => deps.isEligible(relic, index + 1, filters))
      .map((relic) => deps.relicVector(relic, baseStats)),
  );
  if (eligible.some((relics) => relics.length === 0)) return [];

  const twoPieceBySuit = new Map<string, FastVector>();
  filters.suitTwoPieceAttributes?.forEach((attribute, suit) => {
    twoPieceBySuit.set(suit, deps.twoPieceVector(attribute, baseStats));
  });
  const requiredTwoPieceName =
    filters.requiredTwoPieceNames?.size === 1
      ? [...filters.requiredTwoPieceNames][0]
      : undefined;
  const requiredTwoPieceAttribute =
    filters.requiredTwoPieceAttributes?.size === 1
      ? [...filters.requiredTwoPieceAttributes][0]
      : undefined;
  const requiredTwoPieceSuits = requiredTwoPieceName
    ? new Set([requiredTwoPieceName])
    : requiredTwoPieceAttribute
      ? new Set(
          [...twoPieceBySuit.keys()].filter(
            (suit) =>
              suit !== fixedSuit &&
              filters.suitTwoPieceAttributes?.get(suit) ===
                requiredTwoPieceAttribute,
          ),
        )
      : undefined;
  if (requiredTwoPieceSuits && !requiredTwoPieceSuits.size) return [];
  const fixedBonus = twoPieceBySuit.get(fixedSuit) || deps.emptyVector();
  const limit = Math.max(1, Math.floor(resultLimit));

  const required = eligible.map((relics) =>
    constrainedFrontier(relics.filter((relic) => relic.suit === fixedSuit)),
  );
  // 普通套装和一件套混合组成四件套时，必须保留套装激活顺序。
  // 这些特殊配置走通用路径，避免使用简化的套装加成假设。
  if (required.some((relics) => relics.some((relic) => relic.hasOnePieceBonus)))
    return [];

  // 对于两个不同套装，用全局支配的御魂替换其中一件不会降低结果：
  // 它要么保持套装不同，要么额外激活非负的两件套加成。同套装路径单独保留，
  // 并且只在该套装内部应用支配关系。
  const noBonusCandidates = eligible.map(constrainedFrontier);
  const sameSuitCandidateCache = Array.from(
    { length: deps.positionCount },
    () => new Map<string, FastRelic[]>(),
  );
  const getSameSuitCandidates = (position: number, suit: string) => {
    const cached = sameSuitCandidateCache[position].get(suit);
    if (cached) return cached;
    const candidates = constrainedFrontier(
      eligible[position].filter((relic) => relic.suit === suit),
    );
    sameSuitCandidateCache[position].set(suit, candidates);
    return candidates;
  };
  const pairBonusEntries = requiredTwoPieceSuits
    ? [...requiredTwoPieceSuits].flatMap((suit) => {
        const bonus = twoPieceBySuit.get(suit);
        return bonus ? [[suit, bonus] as const] : [];
      })
    : [...twoPieceBySuit.entries()].filter(([suit]) => suit !== fixedSuit);
  const maxPairBonus = pairBonusEntries.reduce<FastVector>(
    (maximum, [_suit, vector]) => deps.maximumVector(maximum, vector),
    deps.emptyVector(),
  );
  const bestResults: FastFixedSuitSearchResult[] = [];
  const bestThreshold = () =>
    bestResults.length >= limit
      ? bestResults[bestResults.length - 1].score
      : Number.NEGATIVE_INFINITY;
  const fixedPatternPriority = (pattern: readonly boolean[]) => {
    let optimistic = fixedBonus;
    for (let position = 0; position < deps.positionCount; position += 1) {
      const candidates = pattern[position]
        ? required[position]
        : eligible[position];
      if (!candidates.length) return Number.NEGATIVE_INFINITY;
      optimistic = deps.sumVectors(
        optimistic,
        candidates.reduce(
          (maximum, relic) => deps.maximumVector(maximum, relic),
          deps.emptyVector(),
        ),
      );
    }
    return deps.metricValue(
      deps.panelForVector(baseStats, deps.sumVectors(optimistic, maxPairBonus)),
      metric,
    );
  };
  const patterns = deps
    .fixedFourPiecePatterns(filters.fixedPatternIndexes)
    .sort(
      (left, right) => fixedPatternPriority(right) - fixedPatternPriority(left),
    );
  const totalPatterns = Math.max(patterns.length, 1);
  const fixedPairFrontierCache = new Map<string, PairCandidate[]>();
  const fixedPairFrontierFor = (
    leftPosition: number,
    rightPosition: number,
  ) => {
    const key = `${leftPosition}:${rightPosition}`;
    const cached = fixedPairFrontierCache.get(key);
    if (cached) return cached;
    const frontier = deps.buildPairFrontier(
      required[leftPosition],
      required[rightPosition],
      fixedSuit,
      twoPieceBySuit,
      dimensions,
      deps.paretoFrontier,
      undefined,
      exactConstraintDimensions,
    );
    fixedPairFrontierCache.set(key, frontier);
    return frontier;
  };

  const accept = (relics: RelicView[], vector: FastVector) => {
    const panel = deps.panelForVector(baseStats, vector);
    if (!deps.satisfiesConstraints(panel, filters.panelConstraints)) return;
    const score = deps.metricValue(panel, metric);
    const criticalRateOverflow = Math.max(0, panel.critRate - 100);
    bestResults.push({ relics, score, criticalRateOverflow });
    bestResults.sort(
      (left, right) =>
        right.score - left.score ||
        left.criticalRateOverflow - right.criticalRateOverflow,
    );
    if (bestResults.length > limit) bestResults.length = limit;
  };

  patterns.forEach((pattern, patternIndex) => {
    const freePositions = pattern
      .map((isFixed, index) => (isFixed ? -1 : index))
      .filter((index) => index >= 0);
    if (freePositions.length !== 2) return;
    const [leftFree, rightFree] = freePositions;
    const pairSearches: PairSearchTree[] = [];
    const allPairCandidates: PairCandidate[] = [];
    if (!requiredTwoPieceSuits || requiredTwoPieceSuits.has(fixedSuit)) {
      const noBonusPairs = deps.buildPairCandidates(
        noBonusCandidates[leftFree],
        noBonusCandidates[rightFree],
        fixedSuit,
        twoPieceBySuit,
      );
      noBonusPairs.forEach((pair) => allPairCandidates.push(pair));
    }
    const pairSuits = requiredTwoPieceSuits || new Set(twoPieceBySuit.keys());
    pairSuits.forEach((suit) => {
      // 固定四件套已经在 fixedBonus 中激活了两件套加成。
      // 同套装的自由两件由 noBonusPairs 覆盖，这里再加入会重复激活同一套加成。
      if (suit === fixedSuit) return;
      const bonus = twoPieceBySuit.get(suit);
      if (suit !== fixedSuit && !bonus) {
        // 指定的一件套或逢魔套没有普通两件套加成，其每件御魂的套装属性
        // 已经包含在 deps.relicVector 中。
        if (!requiredTwoPieceSuits?.has(suit)) return;
      }
      const leftCandidates = getSameSuitCandidates(leftFree, suit);
      const rightCandidates = getSameSuitCandidates(rightFree, suit);
      if (leftCandidates.length && rightCandidates.length) {
        const sameSuitPairs = deps.buildPairCandidates(
          leftCandidates,
          rightCandidates,
          fixedSuit,
          twoPieceBySuit,
          bonus,
        );
        sameSuitPairs.forEach((pair) => allPairCandidates.push(pair));
      }
    });
    const pairFrontier = constrainedFrontier(allPairCandidates);
    if (pairFrontier.length) {
      pairSearches.push(deps.buildPairSearchTree(pairFrontier, baseStats));
    }
    const fixedPositions = pattern
      .map((isFixed, index) => (isFixed ? index : -1))
      .filter((index) => index >= 0);
    const searchFreePair = (fixed: FastVector, chosen: RelicView[]) => {
      pairSearches.forEach((pairSearch) => {
        const visit = (nodeIndex: number): void => {
          const node = pairSearch.nodes[nodeIndex];
          const lowerVector = deps.sumVectors(
            fixed,
            deps.minimumVectorForNode(node),
          );
          const upperVector = deps.sumVectors(fixed, deps.vectorForNode(node));
          const lowerPanel = deps.panelForVector(baseStats, lowerVector);
          const upperPanel = deps.panelForVector(baseStats, upperVector);
          if (
            !deps.canStillSatisfyConstraints(
              lowerPanel,
              upperPanel,
              filters.panelConstraints,
            )
          )
            return;
          const upperScore = deps.metricValue(upperPanel, metric);
          if (upperScore < bestThreshold() - deps.epsilon) {
            return;
          }
          if (node.left === undefined) {
            for (let cursor = node.start; cursor < node.end; cursor += 1) {
              const pair = pairSearch.pairs[cursor];
              const vector = deps.sumVectors(fixed, pair);
              const panel = deps.panelForVector(baseStats, vector);
              if (!deps.satisfiesConstraints(panel, filters.panelConstraints))
                continue;
              const score = deps.metricValue(panel, metric);
              if (score < bestThreshold() - deps.epsilon) continue;
              const relics = [...chosen];
              relics[leftFree] = pair.left.relic;
              relics[rightFree] = pair.right.relic;
              accept(relics, vector);
            }
            return;
          }
          const left = pairSearch.nodes[node.left];
          const right = pairSearch.nodes[node.right!];
          const leftScore = deps.metricValue(
            deps.panelForVector(
              baseStats,
              deps.sumVectors(fixed, deps.vectorForNode(left)),
            ),
            metric,
          );
          const rightScore = deps.metricValue(
            deps.panelForVector(
              baseStats,
              deps.sumVectors(fixed, deps.vectorForNode(right)),
            ),
            metric,
          );
          if (leftScore >= rightScore) {
            visit(node.left);
            visit(node.right!);
          } else {
            visit(node.right!);
            visit(node.left);
          }
        };
        visit(pairSearch.root);
      });
    };

    const pairMaximum = pairSearches.reduce(
      (maximum, pairSearch) =>
        deps.maximumVector(
          maximum,
          deps.vectorForNode(pairSearch.nodes[pairSearch.root]),
        ),
      deps.emptyVector(),
    );
    const orderedFixedPositions = [...fixedPositions].sort(
      (left, right) => required[left].length - required[right].length,
    );
    const firstFixedPair = fixedPairFrontierFor(
      orderedFixedPositions[0],
      orderedFixedPositions[1],
    );
    const secondFixedPair = fixedPairFrontierFor(
      orderedFixedPositions[2],
      orderedFixedPositions[3],
    );
    // 四件固定御魂属于同一套装，所以两件套加成已经包含在 fixedBonus 中。
    // 将四个位置配成两个精确前沿后，可以删除被另一个真实固定前缀在所有相关指标和约束维度上
    // 改善的前缀。
    const quadWorkEstimate = firstFixedPair.length * secondFixedPair.length;
    if (
      pairSearches.length &&
      quadWorkEstimate > 0 &&
      quadWorkEstimate <= 2_000_000
    ) {
      const fixedQuads = deps.buildQuadFrontier(
        firstFixedPair,
        secondFixedPair,
        dimensions,
        deps.paretoFrontier,
        exactConstraintDimensions,
      );
      fixedQuads.forEach((quad) => {
        const fixed = deps.sumVectors(fixedBonus, quad);
        const optimistic = deps.sumVectors(fixed, pairMaximum);
        if (
          !deps.canReachConstraints(
            baseStats,
            optimistic,
            filters.panelConstraints,
          )
        )
          return;
        if (
          deps.metricValue(deps.panelForVector(baseStats, optimistic), metric) <
          bestThreshold() - deps.epsilon
        )
          return;
        const chosen = new Array<RelicView | undefined>(
          deps.positionCount,
        ).fill(undefined);
        chosen[orderedFixedPositions[0]] = quad.first.left.relic;
        chosen[orderedFixedPositions[1]] = quad.first.right.relic;
        chosen[orderedFixedPositions[2]] = quad.second.left.relic;
        chosen[orderedFixedPositions[3]] = quad.second.right.relic;
        searchFreePair(fixed, chosen as RelicView[]);
      });
    } else if (pairSearches.length) {
      const orderedFixedCandidates = orderedFixedPositions.map((position) =>
        [...required[position]].sort(
          (left, right) =>
            deps.priority(right, baseStats) - deps.priority(left, baseStats),
        ),
      );
      const remainingFixedMaximums: FastVector[] = new Array(
        orderedFixedPositions.length + 1,
      );
      remainingFixedMaximums[orderedFixedPositions.length] = deps.emptyVector();
      for (
        let index = orderedFixedPositions.length - 1;
        index >= 0;
        index -= 1
      ) {
        const positionMaximum = orderedFixedCandidates[index].reduce(
          (maximum, relic) => deps.maximumVector(maximum, relic),
          deps.emptyVector(),
        );
        remainingFixedMaximums[index] = deps.sumVectors(
          positionMaximum,
          remainingFixedMaximums[index + 1],
        );
      }
      const chosen = new Array<RelicView | undefined>(deps.positionCount).fill(
        undefined,
      );
      const visitFixed = (depth: number, fixed: FastVector): void => {
        const optimistic = deps.sumVectors(
          deps.sumVectors(fixed, remainingFixedMaximums[depth]),
          pairMaximum,
        );
        if (
          !deps.canReachConstraints(
            baseStats,
            optimistic,
            filters.panelConstraints,
          )
        )
          return;
        if (
          deps.metricValue(deps.panelForVector(baseStats, optimistic), metric) <
          bestThreshold() - deps.epsilon
        )
          return;
        if (depth === orderedFixedPositions.length) {
          searchFreePair(fixed, chosen as RelicView[]);
          return;
        }
        const position = orderedFixedPositions[depth];
        orderedFixedCandidates[depth].forEach((relic) => {
          chosen[position] = relic.relic;
          visitFixed(depth + 1, deps.sumVectors(fixed, relic));
        });
        chosen[position] = undefined;
      };
      visitFixed(0, fixedBonus);
    }
    onProgress?.(patternIndex + 1, totalPatterns);
  });

  return bestResults.filter((result) => {
    if ((deps.countFastSuits(result.relics).get(fixedSuit) || 0) < 4)
      return false;
    return (
      !requiredTwoPieceSuits ||
      [...deps.countFastSuits(result.relics).entries()].some(
        ([suit, count]) => requiredTwoPieceSuits.has(suit) && count >= 2,
      )
    );
  });
}
