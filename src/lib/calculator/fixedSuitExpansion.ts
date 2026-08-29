import type { RelicView } from "@/types";
import type {
  CalculatorFilters,
  CalculatorMetric,
  CalculatedPanel,
  HeroBaseStats,
  PanelConstraintKey,
} from "./types";
import {
  extendFixedSuitState,
  extendKnownSuitState,
  extendUnrestrictedFixedSuitState,
  type BeamState,
  type KnownSuitStep,
} from "./fixedSuitState";
import type { StatBag } from "./relicStats";

type OrderedState = {
  state: BeamState;
  score: number;
  constraintProgress: number;
  criticalRateOverflow: number;
};

export interface FixedSuitExpansionDependencies {
  beamWidth: number;
  bucketWidth: number;
  constraintBucketCount: number;
  panelFor: (base: HeroBaseStats, stats: StatBag) => CalculatedPanel;
  metricValue: (panel: CalculatedPanel, metric: CalculatorMetric) => number;
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
  criticalRateOverflow: (state: BeamState, base: HeroBaseStats) => number;
  usesCriticalRateCap: (metric: CalculatorMetric) => boolean;
  satisfiesPanelConstraints: (
    panel: CalculatedPanel,
    constraints: CalculatorFilters["panelConstraints"],
  ) => boolean;
  offerBest: <T>(
    values: T[],
    value: T,
    limit: number,
    compare: (left: T, right: T) => number,
  ) => void;
  useFastDamageValues: (
    metric: CalculatorMetric,
    filters: CalculatorFilters,
  ) => boolean;
  fastDamageValues: (
    base: HeroBaseStats,
    stats: StatBag,
  ) => { attack: number; speed: number; critRate: number; critDamage: number };
}

/**
 * 扩展满暴搜索中的固定套装状态。
 * 同时保留指标前沿和约束进度前沿，避免中间层过早丢失六号位爆伤路线。
 */
export function expandCriticalFixedSuitStates(
  beam: BeamState[],
  relics: RelicView[],
  base: HeroBaseStats,
  metric: CalculatorMetric,
  filters: CalculatorFilters,
  finalPosition: boolean,
  resultLimit: number,
  shouldSkip: ((stats: StatBag) => boolean) | undefined,
  knownStep: KnownSuitStep | undefined,
  useUnrestrictedFixedSuitState: boolean,
  fixedSuitName: string,
  onProgress: ((processed: number, total: number) => void) | undefined,
  deps: FixedSuitExpansionDependencies,
): BeamState[] {
  const searchConstraints = deps.constraintsForSearch(filters, metric);
  const useFastDamageValues = deps.useFastDamageValues(metric, filters);
  /**
   * 该函数位于满暴击状态扩展的最热循环。通用约束工具每次都会重新枚举对象、
   * 过滤字段并创建数组；当前一次搜索中的约束和基础面板不会变化，因此预编译
   * 约束列表后直接计算，结果与通用工具保持逐项一致。
   */
  const constraintEntries = Object.entries(searchConstraints || {}).map(
    ([rawKey, range]) => ({ key: rawKey as PanelConstraintKey, range }),
  );
  const minimumConstraintEntries = constraintEntries.filter(
    ({ key, range }) =>
      range?.min !== undefined && range.min > base[key],
  );
  /**
   * 非极速满暴击路径原本会分别扫描约束两次：一次求保留优先级，一次求分桶。
   * 两个值都只依赖当前面板和不变的约束，合并后可避免每个中间状态的重复遍历。
   * 该对象只在同步热循环中读取标量，复用不会泄漏到任何搜索状态。
   */
  const panelClassification = { progress: 0, bucket: 0 };
  const classifyPanel = (panel: CalculatedPanel): void => {
    let progress = 0;
    let bucket = 0;
    for (const { key, range } of constraintEntries) {
      const actual = panel[key];
      if (range?.min !== undefined && range.min > base[key]) {
        progress += Math.min(actual / Math.max(Math.abs(range.min), 1), 1);
        const minimum = range.min;
        const minimumProgress = Math.max(
          0,
          Math.min(1, (actual - base[key]) / (minimum - base[key])),
        );
        bucket =
          bucket * (deps.constraintBucketCount + 1) +
          Math.floor(minimumProgress * deps.constraintBucketCount);
      }
      if (range?.max !== undefined) {
        const scale = Math.max(Math.abs(range.max), 1);
        progress +=
          actual <= range.max ? 1 : -Math.abs(actual - range.max) / scale;
      }
    }
    panelClassification.progress = progress;
    panelClassification.bucket = bucket;
  };
  /**
   * 每个约束桶值都在 0..bucketCount 之间。按固定顺序做进制编码，既保留
   * 原先“暴击档位 + 每条下限约束档位”的一一对应关系，又避免热循环为每个
   * 状态分配数组和拼接字符串。11 项属性、8 个分桶时仍远小于安全整数范围。
   */
  const constraintBucketRadix = deps.constraintBucketCount + 1;
  const constraintSignatureSpan = constraintBucketRadix ** minimumConstraintEntries.length;
  // 极速伤害路径仍保留其速度专用字符串键；常规满暴击路径使用数值键。
  const buckets = new Map<
    string | number,
    { byMetric: OrderedState[]; byConstraint: OrderedState[] }
  >();
  const finalStates: OrderedState[] = [];
  const totalOperations = beam.length * relics.length;
  const progressStep = Math.max(2048, Math.ceil(totalOperations / 100));
  let processedOperations = 0;

  const compareByMetric = (left: OrderedState, right: OrderedState) => {
    const scoreDelta = right.score - left.score;
    return deps.usesCriticalRateCap(metric)
      ? scoreDelta || left.criticalRateOverflow - right.criticalRateOverflow
      : scoreDelta;
  };
  const compareByConstraint = (left: OrderedState, right: OrderedState) => {
    const progressDelta = right.constraintProgress - left.constraintProgress;
    if (Math.abs(progressDelta) > Number.EPSILON) return progressDelta;
    return compareByMetric(left, right);
  };
  const report = () => {
    if (
      onProgress &&
      (processedOperations === totalOperations ||
        processedOperations % progressStep === 0)
    ) {
      onProgress(processedOperations, totalOperations);
    }
  };

  // 满暴击路径会在每一层枚举大量“当前状态 × 候选御魂”。索引循环避免
  // forEach 为每次扩展创建回调调用边界；不改变状态生成、约束判断和保留顺序。
  for (let stateIndex = 0; stateIndex < beam.length; stateIndex += 1) {
    const state = beam[stateIndex];
    for (let relicIndex = 0; relicIndex < relics.length; relicIndex += 1) {
      const relic = relics[relicIndex];
      processedOperations += 1;
      const nextState = knownStep
        ? extendKnownSuitState(state, relic, knownStep)
        : useUnrestrictedFixedSuitState
          ? extendUnrestrictedFixedSuitState(
              state,
              relic,
              filters,
              fixedSuitName,
            )
          : extendFixedSuitState(state, relic, filters);
      if (shouldSkip?.(nextState.stats)) {
        report();
        continue;
      }
      const fastValues = useFastDamageValues
        ? deps.fastDamageValues(base, nextState.stats)
        : undefined;
      const panel =
        finalPosition || !fastValues
          ? deps.panelFor(base, nextState.stats)
          : undefined;
      if (!fastValues && !finalPosition) classifyPanel(panel!);
      const entry: OrderedState = {
        state: nextState,
        score: fastValues
          ? fastValues.attack * fastValues.critDamage * 0.01
          : deps.metricValue(panel!, metric),
        constraintProgress: fastValues
          ? fastValues.speed /
            Math.max(Math.abs(searchConstraints?.speed?.min || 0), 1)
          : finalPosition
            ? 0
            : panelClassification.progress,
        criticalRateOverflow: deps.criticalRateOverflow(nextState, base),
      };
      if (finalPosition) {
        if (deps.satisfiesPanelConstraints(panel!, filters.panelConstraints)) {
          deps.offerBest(finalStates, entry, resultLimit, compareByMetric);
        }
        report();
        continue;
      }

      const bucket = fastValues
        ? `${Math.floor(fastValues.critRate / 2)}|speed:${Math.floor(
            Math.max(
              0,
              Math.min(
                1,
                (fastValues.speed - base.speed) /
                  ((searchConstraints?.speed?.min || base.speed) - base.speed),
              ),
            ) * deps.constraintBucketCount,
          )}`
        : Math.floor(panel!.critRate / 2) * constraintSignatureSpan +
          panelClassification.bucket;
      const group = buckets.get(bucket) || {
        byMetric: [],
        byConstraint: [],
      };
      buckets.set(bucket, group);
      deps.offerBest(group.byMetric, entry, deps.bucketWidth, compareByMetric);
      deps.offerBest(
        group.byConstraint,
        entry,
        deps.bucketWidth,
        compareByConstraint,
      );
      report();
    }
  }

  if (finalPosition) {
    return finalStates.sort(compareByMetric).map(({ state }) => state);
  }
  const selected: BeamState[] = [];
  const seen = new Set<BeamState>();
  buckets.forEach((group) => {
    [
      ...group.byMetric.sort(compareByMetric),
      ...group.byConstraint.sort(compareByConstraint),
    ].forEach(({ state }) => {
      if (seen.has(state)) return;
      seen.add(state);
      selected.push(state);
    });
  });
  return selected;
}
