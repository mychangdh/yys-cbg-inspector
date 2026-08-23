import type {
  CalculatorFilters,
  CalculatorMetric,
  CalculatedPanel,
  HeroBaseStats,
  PanelConstraintKey,
} from "./types";
import type { BeamState } from "./fixedSuitState";

export interface FixedSuitRetentionDependencies {
  beamWidth: number;
  stateReserve: number;
  critBucketWidth: number;
  constraintBucketCount: number;
  panelFor: (base: HeroBaseStats, stats: BeamState["stats"]) => CalculatedPanel;
  metricValue: (panel: CalculatedPanel, metric: CalculatorMetric) => number;
  satisfiesPanelConstraints: (
    panel: CalculatedPanel,
    constraints: CalculatorFilters["panelConstraints"],
  ) => boolean;
  constraintsForSearch: (
    filters: CalculatorFilters,
    metric: CalculatorMetric,
  ) => CalculatorFilters["panelConstraints"];
  panelConstraintProgress: (
    panel: CalculatedPanel,
    constraints: CalculatorFilters["panelConstraints"],
    base: HeroBaseStats,
  ) => number;
  panelConstraintBucketSignature: (
    panel: CalculatedPanel,
    constraints: CalculatorFilters["panelConstraints"],
    base: HeroBaseStats,
    bucketCount: number,
  ) => string;
  compareCriticalOverflow: (
    left: BeamState,
    right: BeamState,
    base: HeroBaseStats,
    metric: CalculatorMetric,
  ) => number;
  usesCriticalRateCap: (metric: CalculatorMetric) => boolean;
  takeBest: <T>(
    values: readonly T[],
    limit: number,
    compare: (left: T, right: T) => number,
  ) => T[];
}

/**
 * 保留固定套装搜索的候选状态。
 * 这里刻意同时保留指标最优、约束进度最优和各约束边界候选，
 * 否则多约束、满暴和六号位爆伤组合可能在中间层被误删。
 */
export function retainFixedSuitStates(
  states: BeamState[],
  base: HeroBaseStats,
  metric: CalculatorMetric,
  filters: CalculatorFilters,
  finalPosition: boolean,
  resultLimit: number,
  deps: FixedSuitRetentionDependencies,
): BeamState[] {
  const panelCache = new Map<BeamState, CalculatedPanel>();
  const panelForState = (state: BeamState) => {
    const cached = panelCache.get(state);
    if (cached) return cached;
    const panel = deps.panelFor(base, state.stats);
    panelCache.set(state, panel);
    return panel;
  };
  const compareByMetric = (left: BeamState, right: BeamState) =>
    deps.metricValue(panelForState(right), metric) -
      deps.metricValue(panelForState(left), metric) ||
    deps.compareCriticalOverflow(left, right, base, metric);

  const valid = finalPosition
    ? states.filter((state) =>
        deps.satisfiesPanelConstraints(
          panelForState(state),
          filters.panelConstraints,
        ),
      )
    : [];
  if (valid.length) {
    return deps.takeBest(
      valid,
      finalPosition ? resultLimit : deps.beamWidth,
      compareByMetric,
    );
  }

  const critRateConstraint = filters.panelConstraints?.critRate;
  if (
    deps.usesCriticalRateCap(metric) &&
    critRateConstraint?.min !== undefined &&
    critRateConstraint.min > base.critRate
  ) {
    const searchConstraints = deps.constraintsForSearch(filters, metric);
    const buckets = new Map<string, BeamState[]>();
    states.forEach((state) => {
      const panel = panelForState(state);
      const bucket = `${Math.floor(panel.critRate / 2)}|${deps.panelConstraintBucketSignature(
        panel,
        searchConstraints,
        base,
        deps.constraintBucketCount,
      )}`;
      const group = buckets.get(bucket);
      if (group) group.push(state);
      else buckets.set(bucket, [state]);
    });
    const bucketed = [...buckets.values()].map((items) => {
      const selected: BeamState[] = [];
      const add = (state: BeamState) => {
        if (!selected.includes(state)) selected.push(state);
      };
      deps.takeBest(items, deps.critBucketWidth, compareByMetric).forEach(add);
      deps
        .takeBest(items, deps.critBucketWidth, (left, right) => {
          const progressDelta =
            deps.panelConstraintProgress(
              panelForState(right),
              searchConstraints,
              base,
            ) -
            deps.panelConstraintProgress(
              panelForState(left),
              searchConstraints,
              base,
            );
          if (Math.abs(progressDelta) > Number.EPSILON) return progressDelta;
          return compareByMetric(left, right);
        })
        .forEach(add);
      return selected;
    });
    if (bucketed.length) return bucketed.flat();
  }

  if (states.length <= deps.beamWidth) return states;
  const selected: BeamState[] = [];
  const seen = new Set<BeamState>();
  const add = (state: BeamState) => {
    if (!seen.has(state) && selected.length < deps.beamWidth) {
      seen.add(state);
      selected.push(state);
    }
  };
  deps.takeBest(states, deps.stateReserve, compareByMetric).forEach(add);
  deps
    .takeBest(states, deps.stateReserve, (left, right) => {
      const delta =
        deps.panelConstraintProgress(
          panelForState(right),
          filters.panelConstraints,
          base,
        ) -
        deps.panelConstraintProgress(
          panelForState(left),
          filters.panelConstraints,
          base,
        );
      if (Math.abs(delta) > Number.EPSILON) return delta;
      return compareByMetric(left, right);
    })
    .forEach(add);

  Object.entries(filters.panelConstraints || {})
    .filter(([rawKey, range]) => {
      const key = rawKey as PanelConstraintKey;
      return (
        (range?.min !== undefined && range.min > base[key]) ||
        range?.max !== undefined
      );
    })
    .forEach(([rawKey, range]) => {
      const key = rawKey as PanelConstraintKey;
      const descending = range?.max === undefined;
      deps
        .takeBest(states, deps.stateReserve, (left, right) => {
          const delta = panelForState(right)[key] - panelForState(left)[key];
          return (
            (descending ? delta : -delta) ||
            deps.compareCriticalOverflow(left, right, base, metric)
          );
        })
        .forEach(add);
    });
  return selected;
}
