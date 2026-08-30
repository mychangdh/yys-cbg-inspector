import type { RelicView } from "@/types";
import type {
  CalculatorFilters,
  CalculatorMetric,
  CalculatorProgress,
  CalculatorResult,
  CalculatedPanel,
  HeroBaseStats,
} from "./types";

type StatBag = Record<string, number>;
type RelicChain = { relic: RelicView; previous?: RelicChain };
type BeamState = {
  relics?: RelicChain;
  stats: StatBag;
  suitCounts: Readonly<Record<string, number>>;
};

type PanelConstraints = CalculatorFilters["panelConstraints"];
type TakeBest = <T>(
  items: readonly T[],
  limit: number,
  compare: (left: T, right: T) => number,
) => T[];

export type GeneralBeamDependencies = {
  constraintsForSearch: (
    filters: CalculatorFilters,
    metric: CalculatorMetric,
  ) => PanelConstraints;
  panelConstraintProgress: (
    panel: CalculatedPanel,
    constraints: PanelConstraints,
    base: HeroBaseStats,
  ) => number;
  panelConstraintBucketSignature: (
    panel: CalculatedPanel,
    constraints: PanelConstraints,
    base: HeroBaseStats,
  ) => string;
  requirementSignature: (
    suitCounts: Readonly<Record<string, number>>,
    filters: CalculatorFilters,
  ) => string;
  prioritizeResults: (
    results: readonly CalculatorResult[],
    filters: CalculatorFilters,
    metric: CalculatorMetric,
    resultLimit: number,
  ) => CalculatorResult[];
  relicsForState: (state: BeamState) => RelicView[];
  createEmptyStatBag: () => StatBag;
  parseTwoPieceAttribute: (text?: string) => RelicView["mainAttribute"] | null;
  criticalRateOverflow: (state: BeamState, base: HeroBaseStats) => number;
  criticalRateBucket: (state: BeamState, base: HeroBaseStats) => number;
  hasFullCriticalRateConstraint: (
    filters: CalculatorFilters,
    metric: CalculatorMetric,
  ) => boolean;
  usesCriticalRateCap: (metric: CalculatorMetric) => boolean;
  resultForState: (
    state: BeamState,
    base: HeroBaseStats,
    metric: CalculatorMetric,
  ) => CalculatorResult;
  metricValue: (panel: CalculatedPanel, metric: CalculatorMetric) => number;
  panelFor: (base: HeroBaseStats, stats: StatBag) => CalculatedPanel;
  addAttribute: (stats: StatBag, attribute: RelicView["mainAttribute"]) => void;
  addRelic: (stats: StatBag, relic: RelicView) => void;
  relicStatsFor: (relic: RelicView) => StatBag;
  takeBest: TakeBest;
  beamWidth: number;
  requirementBeamWidth: number;
  fullCritBucketWidth: number;
  fastBeamWidth: number;
  fastRequirementBeamWidth: number;
  fastFullCritBucketWidth: number;
};

type GeneralBeamInput = {
  candidates: RelicView[][];
  base: HeroBaseStats;
  metric: CalculatorMetric;
  filters: CalculatorFilters;
  resultLimit: number;
  progress?: (value: CalculatorProgress) => void;
  compactGeneralTopResult?: CalculatorResult;
};

/**
 * 执行通用搜索的 Beam 状态扩展与前沿保留。
 * 固定套装布局由固定套装搜索模块处理，这里只负责普通组合和多约束状态。
 */
export function runGeneralBeamSearch(
  input: GeneralBeamInput,
  deps: GeneralBeamDependencies,
): CalculatorResult[] {
  const {
    candidates,
    base,
    metric,
    filters,
    resultLimit,
    progress,
    compactGeneralTopResult,
  } = input;
  const searchConstraints = deps.constraintsForSearch(filters, metric);
  const preserveFullCritFrontier = deps.hasFullCriticalRateConstraint(
    filters,
    metric,
  );
  // 通用模式保留完整候选前沿，极速模式只使用等价的缩小前沿。
  // 通用模式保留完整候选前沿，极速模式只使用等价的缩小前沿。
  // 通用模式保留完整候选前沿，极速模式只使用等价的缩小前沿。
  const beamWidth = filters.fastMode ? deps.fastBeamWidth : deps.beamWidth;
  const requirementBeamWidth = filters.fastMode
    ? deps.fastRequirementBeamWidth
    : deps.requirementBeamWidth;
  const fullCritBucketWidth = filters.fastMode
    ? deps.fastFullCritBucketWidth
    : deps.fullCritBucketWidth;
  const hasSetRequirements = Boolean(
    filters.requiredFourPiece ||
    filters.requiredTwoPieceNames?.size ||
    filters.requiredTwoPieceAttributes?.size,
  );
  let beam: BeamState[] = [
    { stats: deps.createEmptyStatBag(), suitCounts: {} },
  ];
  let processedRelics = 0;
  const totalRelics = candidates.reduce(
    (total, items) => total + items.length,
    0,
  );
  candidates.forEach((items) => {
    processedRelics += items.length;
    const next: BeamState[] = [];
    beam.forEach((state) =>
      items.forEach((relic) => {
        const stats = { ...state.stats };
        deps.addRelic(stats, relic);
        const suit = relic.suit?.name || "";
        let suitCounts = state.suitCounts;
        if (suit) {
          const nextCount = (suitCounts[suit] || 0) + 1;
          suitCounts = { ...suitCounts, [suit]: nextCount };
          // 普通御魂只在第二件时触发一次两件套属性，逢魔属性由御魂自身处理。
          if (nextCount === 2 && !relic.setBonusAttribute) {
            deps.addAttribute(
              stats,
              deps.parseTwoPieceAttribute(
                filters.suitTwoPieceAttributes?.get(suit),
              ),
            );
          }
        }
        next.push({
          relics: { relic, previous: state.relics },
          stats,
          suitCounts,
        });
      }),
    );
    // 扩展阶段保留暴击前沿，暴击溢出只参与同分排序。
    const viableNext = next;
    const panelCache = new Map<BeamState, CalculatedPanel>();
    const getPanel = (state: BeamState) => {
      const cached = panelCache.get(state);
      if (cached) return cached;
      const panel = deps.panelFor(base, state.stats);
      panelCache.set(state, panel);
      return panel;
    };
    const rankCache = new Map<
      BeamState,
      {
        score: number;
        constraintProgress: number;
        criticalOverflow: number;
      }
    >();
    const getRank = (state: BeamState) => {
      const cached = rankCache.get(state);
      if (cached) return cached;
      const panel = getPanel(state);

      const rank = {
        score: deps.metricValue(panel, metric),
        constraintProgress: deps.panelConstraintProgress(
          panel,
          searchConstraints,
          base,
        ),
        criticalOverflow: deps.criticalRateOverflow(state, base),
      };
      rankCache.set(state, rank);
      return rank;
    };
    const compareStates = (a: BeamState, b: BeamState) => {
      const aRank = getRank(a);
      const bRank = getRank(b);
      const constraintDelta =
        bRank.constraintProgress - aRank.constraintProgress;
      if (Math.abs(constraintDelta) > Number.EPSILON)
        return constraintDelta * 100_000_000;
      return (
        bRank.score - aRank.score ||
        (deps.usesCriticalRateCap(metric)
          ? aRank.criticalOverflow - bRank.criticalOverflow
          : 0)
      );
    };
    const critBucketed = new Map<number, BeamState[]>();
    viableNext.forEach((state) => {
      const bucket = preserveFullCritFrontier
        ? deps.criticalRateBucket(state, base)
        : 0;
      const group = critBucketed.get(bucket);
      if (group) group.push(state);
      else critBucketed.set(bucket, [state]);
    });
    const retainedNext = [...critBucketed.values()].flatMap((states) =>
      deps.takeBest(
        states,
        preserveFullCritFrontier ? fullCritBucketWidth : beamWidth,
        compareStates,
      ),
    );
    if (!hasSetRequirements) {
      beam = preserveFullCritFrontier
        ? retainedNext
        : retainedNext.slice(0, beamWidth);
      progress?.({
        processedRelics: Math.min(processedRelics, totalRelics),
        totalRelics,
        results: deps.prioritizeResults(
          beam.map((state) => deps.resultForState(state, base, metric)),
          filters,
          metric,
          resultLimit,
        ),
      });
      return;
    }
    const grouped = new Map<string, BeamState[]>();
    // 有套装约束时先按套装进度分桶，避免尚未成套的路径被提前淘汰。
    viableNext.forEach((state) => {
      const statePanel = getPanel(state);
      const signature = `${deps.requirementSignature(state.suitCounts, filters)}:${
        preserveFullCritFrontier ? deps.criticalRateBucket(state, base) : "all"
      }:${deps.panelConstraintBucketSignature(statePanel, searchConstraints, base)}`;
      const group = grouped.get(signature);
      if (group) group.push(state);
      else grouped.set(signature, [state]);
    });
    beam = [...grouped.values()].flatMap((states) =>
      deps.takeBest(
        states,
        preserveFullCritFrontier ? fullCritBucketWidth : requirementBeamWidth,
        compareStates,
      ),
    );
    progress?.({
      processedRelics: Math.min(processedRelics, totalRelics),
      totalRelics,
      results: deps.prioritizeResults(
        beam.map((state) => deps.resultForState(state, base, metric)),
        filters,
        metric,
        resultLimit,
      ),
    });
  });

  const results = beam
    .map((state) => {
      const stats = { ...state.stats };
      const panel = deps.panelFor(base, stats);
      return {
        score: deps.metricValue(panel, metric),
        panel,
        relics: deps.relicsForState(state),
        criticalRateOverflow: deps.criticalRateOverflow(state, base),
        suits: Object.entries(state.suitCounts)
          .filter(([, count]) => count >= 2)
          .sort((a, b) => b[1] - a[1])

          .map(([name, count]) => `${name} x ${count}`),
      };
    })
    .filter((result) => {
      for (const [key, value] of Object.entries(
        filters.panelConstraints || {},
      )) {
        const actual = result.panel[key as keyof CalculatedPanel];
        if (value?.min !== undefined && actual < value.min) return false;
        if (value?.max !== undefined && actual > value.max) return false;
      }
      const counts = new Map<string, number>();
      result.relics.forEach((relic) => {
        const name = relic.suit?.name;
        if (name) counts.set(name, (counts.get(name) || 0) + 1);
      });
      if (
        filters.requiredFourPiece &&
        (counts.get(filters.requiredFourPiece) || 0) < 4
      )
        return false;
      for (const name of filters.requiredTwoPieceNames || []) {
        if ((counts.get(name) || 0) < 2) return false;
      }
      for (const attribute of filters.requiredTwoPieceAttributes || []) {
        const active = [...counts.entries()].some(
          ([name, count]) =>
            name !== filters.requiredFourPiece &&
            count >= 2 &&
            filters.suitTwoPieceAttributes?.get(name) === attribute,
        );
        if (!active) return false;
      }
      return [...counts.values()].filter((count) => count >= 4).length <= 1;
    });
  return deps.prioritizeResults(
    [...(compactGeneralTopResult ? [compactGeneralTopResult] : []), ...results],
    filters,
    metric,
    resultLimit,
  );
}
