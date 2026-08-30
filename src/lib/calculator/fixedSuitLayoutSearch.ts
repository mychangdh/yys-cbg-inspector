import type { RelicView } from "@/types";
import type {
  CalculatorFilters,
  CalculatorMetric,
  CalculatorProgress,
  CalculatorProgressStage,
  CalculatorResult,
  CalculatedPanel,
  HeroBaseStats,
  PanelConstraintKey,
} from "./types";
import type { FixedSuitLayoutPlan } from "./fixedSuitPlan";
import type { BeamState, KnownSuitStep } from "./fixedSuitState";
import type { StatBag } from "./relicStats";
import type { expandCriticalFixedSuitStates } from "./fixedSuitExpansion";
import type { retainFixedSuitStates } from "./fixedSuitRetention";

type PatternCandidateSet = {
  candidates: RelicView[];
  matchingCount: number;
  /**
   * 支配裁剪以套装名为分组边界。保留这份中间结果后，具体两件套阶段可以
   * 直接按套装过滤，而不需要对同一号位的每个套装重复执行支配比较。
   */
  undominated: RelicView[];
};
type PatternCandidateCache = Map<string, PatternCandidateSet>;

export interface FixedSuitLayoutSearchDependencies {
  positionCount: number;
  fixedSuitBeamWidth: number;
  fastFixedSuitBeamWidth: number;
  fixedSuitCritBucketWidth: number;
  fastFixedSuitCritBucketWidth: number;
  fixedSuitConstraintBucketCount: number;
  fastFixedSuitConstraintBucketCount: number;
  fastFixedSuitStateReserve: number;
  createEmptyStatBag: () => StatBag;
  addStats: (target: StatBag, source: StatBag) => void;
  maximumCandidateStats: (relics: RelicView[]) => StatBag;
  removeDominatedRelics: (
    relics: RelicView[],
    metric: CalculatorMetric,
    filters: CalculatorFilters,
    base: HeroBaseStats,
  ) => RelicView[];
  fixedPatternCandidates: (
    relics: RelicView[],
    positionIndex: number,
    base: HeroBaseStats,
    metric: CalculatorMetric,
    filters: CalculatorFilters,
  ) => RelicView[];
  potentialFixedSuitTwoPieceStats: (
    filters: CalculatorFilters,
    fixedSuitName: string,
    fixedPieceCount: 2 | 4,
    twoPieceName: string | undefined,
  ) => StatBag;
  knownSuitSteps: (
    pattern: readonly boolean[],
    fixedSuitName: string,
    twoPieceName: string,
    filters: CalculatorFilters,
  ) => KnownSuitStep[];
  knownFixedSuitSteps: (
    pattern: readonly boolean[],
    fixedSuitName: string,
    filters: CalculatorFilters,
  ) => Array<KnownSuitStep | undefined>;
  extendFixedSuitState: (
    state: BeamState,
    relic: RelicView,
    filters: CalculatorFilters,
  ) => BeamState;
  extendUnrestrictedFixedSuitState: (
    state: BeamState,
    relic: RelicView,
    filters: CalculatorFilters,
    fixedSuitName: string,
  ) => BeamState;
  extendKnownSuitState: (
    state: BeamState,
    relic: RelicView,
    knownStep: KnownSuitStep,
  ) => BeamState;
  usesCriticalRateCap: (metric: CalculatorMetric) => boolean;
  isFastDamageConstraintPath: (
    metric: CalculatorMetric,
    filters: CalculatorFilters,
  ) => boolean;
  fastDamageValues: (
    base: HeroBaseStats,
    stats: StatBag,
  ) => { attack: number; speed: number; critRate: number; critDamage: number };
  panelFor: (base: HeroBaseStats, stats: StatBag) => CalculatedPanel;
  metricValue: (panel: CalculatedPanel, metric: CalculatorMetric) => number;
  satisfiesPanelConstraints: (
    panel: CalculatedPanel,
    constraints: CalculatorFilters["panelConstraints"],
  ) => boolean;
  prioritizeResults: (
    results: CalculatorResult[],
    filters: CalculatorFilters,
    metric: CalculatorMetric,
    limit: number,
  ) => CalculatorResult[];
  resultForState: (
    state: BeamState,
    base: HeroBaseStats,
    metric: CalculatorMetric,
  ) => CalculatorResult;
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
  compareCriticalOverflow: (
    left: BeamState,
    right: BeamState,
    base: HeroBaseStats,
    metric: CalculatorMetric,
  ) => number;
  takeBest: <T>(
    values: readonly T[],
    limit: number,
    compare: (left: T, right: T) => number,
  ) => T[];
  offerBest: <T>(
    values: T[],
    value: T,
    limit: number,
    compare: (left: T, right: T) => number,
  ) => void;
  expandCriticalFixedSuitStates: typeof expandCriticalFixedSuitStates;
  retainFixedSuitStates: typeof retainFixedSuitStates;
  createLayoutPlan: (
    eligibleRelics: RelicView[][],
    filters: CalculatorFilters,
    fixedSuitName: string,
    fixedPieceCount: 2 | 4,
    twoPieceNames: readonly string[] | undefined,
  ) => FixedSuitLayoutPlan;
  constrainedMetricUpperBound: (
    base: HeroBaseStats,
    currentStats: StatBag,
    remainingStats: StatBag,
    twoPieceStats: StatBag,
    metric: CalculatorMetric,
    constraints: CalculatorFilters["panelConstraints"],
  ) => number;
}

export function calculateFixedSuitLayouts(
  eligibleRelics: RelicView[][],
  base: HeroBaseStats,
  metric: CalculatorMetric,
  filters: CalculatorFilters,
  fixedSuitName: string,
  fixedPieceCount: 2 | 4,
  twoPieceNames: readonly string[] | undefined,
  resultLimit: number,
  progress: ((value: CalculatorProgress) => void) | undefined,
  layoutPlan: FixedSuitLayoutPlan | undefined,
  initialBestResults: readonly CalculatorResult[] | undefined,
  sharedPatternCandidateCache: PatternCandidateCache | undefined,
  deps: FixedSuitLayoutSearchDependencies,
): CalculatorResult[] {
  // 四件套和指定两件套只有 15 种号位分配方式。两件套属性（例如“暴击 +15%”）
  // 会先展开为同属性的具体御魂套装，确保最终两件来自同一套装并真正触发效果。
  const results: CalculatorResult[] = [];
  let fastBestResult = filters.fastMode ? initialBestResults?.[0] : undefined;
  const layoutResultLimit = filters.fastMode ? 1 : resultLimit;
  let normalBestResults: CalculatorResult[] = filters.fastMode
    ? []
    : deps.prioritizeResults(
        [...(initialBestResults || [])],
        filters,
        metric,
        resultLimit,
      );
  const initialNormalBestResults = normalBestResults;
  let processedRelics = 0;
  const plan =
    layoutPlan ||
    deps.createLayoutPlan(
      eligibleRelics,
      filters,
      fixedSuitName,
      fixedPieceCount,
      twoPieceNames,
    );
  /**
   * 一个固定套搜索会反复访问相同的“号位 + 套装”候选集：布局上界排序、候选
   * 准备、具体两件套展开都会读取它。直接对原始数组 filter 在六千件仓库和几十
   * 个两件套名称下会产生大量重复扫描；索引仅保存原数组中的引用，不会改变候选
   * 顺序、属性或筛选结果。
   */
  const relicsByPositionAndSuit = eligibleRelics.map((relics) => {
    const bySuit = new Map<string, RelicView[]>();
    relics.forEach((relic) => {
      const suitName = relic.suit?.name || "";
      const items = bySuit.get(suitName);
      if (items) items.push(relic);
      else bySuit.set(suitName, [relic]);
    });
    return { all: relics, bySuit };
  });
  const matchingRelics = (
    positionIndex: number,
    isFourPiece: boolean,
    twoPieceName: string | undefined,
  ): RelicView[] => {
    const indexed = relicsByPositionAndSuit[positionIndex];
    const suitName = isFourPiece ? fixedSuitName : twoPieceName;
    return suitName ? indexed.bySuit.get(suitName) || [] : indexed.all;
  };
  /**
   * 每个布局相互独立，先后顺序不会改变任何布局的候选或约束。优先执行理论
   * 上界较高的布局，可以更早建立真实分数下界；普通模式随后同样能用这个
   * 下界跳过不可能进入 Top-N 的布局，而不只让极速模式受益。
   */
  const patternVariants = plan.variants
    .map((variant) => {
      const optimistic: StatBag = {};
      variant.pattern.forEach((isFourPiece, positionIndex) => {
        const matching = matchingRelics(
          positionIndex,
          isFourPiece,
          variant.twoPieceName,
        );
        deps.addStats(optimistic, deps.maximumCandidateStats(matching));
      });
      return {
        variant,
        upperBound: deps.constrainedMetricUpperBound(
          base,
          {},
          optimistic,
          deps.potentialFixedSuitTwoPieceStats(
            filters,
            fixedSuitName,
            fixedPieceCount,
            variant.twoPieceName,
          ),
          metric,
          filters.panelConstraints,
        ),
      };
    })
    .sort((left, right) => right.upperBound - left.upperBound)
    .map(({ variant }) => variant);
  // 面板上下限均可用于严格可行性剪枝：当前值超过上限不会再下降，
  // 剩余位置都取理论最大值仍达不到下限也不可能成为有效组合。
  // 不把“基础面板本来就已满足的纯下限”计入，避免无收益地重复计算上界。
  const hasActivePanelConstraint = Object.entries(
    filters.panelConstraints || {},
  ).some(([rawKey, range]) => {
    const key = rawKey as keyof HeroBaseStats;
    return (
      range?.max !== undefined ||
      (range?.min !== undefined && range.min > base[key])
    );
  });
  /**
   * 御魂和基础面板在单个布局搜索期间不会改变。预先排除基础面板本就满足的
   * 下限，并把对象枚举移出每个中间状态的热循环，只保留实际需要检查的边界。
   */
  const activePanelConstraintEntries = Object.entries(
    filters.panelConstraints || {},
  ).flatMap(([rawKey, range]) => {
    const key = rawKey as PanelConstraintKey;
    if (
      range?.max === undefined &&
      (range?.min === undefined || range.min <= base[key])
    ) {
      return [];
    }
    return [{ key, min: range?.min, max: range?.max }];
  });
  const percentBuffs = (
    base as HeroBaseStats & { buffPercents?: Partial<StatBag> }
  ).buffPercents;
  /**
   * 约束检查是固定套状态扩展的热路径。这里直接读取固定的 StatBag 字段，
   * 避免通用函数为每次检查创建动态百分比字段名；百分比仍只乘式神基础属性，
   * 后续平铺属性在百分比计算后相加，和最终面板公式完全一致。
   */
  const panelValueForState = (
    stats: StatBag,
    key: PanelConstraintKey,
    future?: StatBag,
    potentialBonus?: StatBag,
  ): number => {
    switch (key) {
      case "attack":
        return (
          base.attack *
            (1 +
              ((stats.attackPercent || 0) +
                (future?.attackPercent || 0) +
                (potentialBonus?.attackPercent || 0) +
                (percentBuffs?.attackPercent || 0)) /
                100) +
          (stats.attack || 0) +
          (future?.attack || 0) +
          (potentialBonus?.attack || 0)
        );
      case "health":
        return (
          base.health *
            (1 +
              ((stats.healthPercent || 0) +
                (future?.healthPercent || 0) +
                (potentialBonus?.healthPercent || 0) +
                (percentBuffs?.healthPercent || 0)) /
                100) +
          (stats.health || 0) +
          (future?.health || 0) +
          (potentialBonus?.health || 0)
        );
      case "defense":
        return (
          base.defense *
            (1 +
              ((stats.defensePercent || 0) +
                (future?.defensePercent || 0) +
                (potentialBonus?.defensePercent || 0) +
                (percentBuffs?.defensePercent || 0)) /
                100) +
          (stats.defense || 0) +
          (future?.defense || 0) +
          (potentialBonus?.defense || 0)
        );
      default:
        return (
          base[key] +
          (stats[key] || 0) +
          (future?.[key] || 0) +
          (potentialBonus?.[key] || 0)
        );
    }
  };
  const cannotSatisfyRemainingConstraints = (
    stats: StatBag,
    future: StatBag,
    potentialBonus: StatBag,
  ): boolean => {
    for (const { key, min, max } of activePanelConstraintEntries) {
      if (max !== undefined && panelValueForState(stats, key) > max) {
        return true;
      }
      if (
        min !== undefined &&
        panelValueForState(stats, key, future, potentialBonus) < min
      ) {
        return true;
      }
    }
    return false;
  };
  /**
   * 当已有 Top-N 下界时，这个判断位于每个中间状态的热循环。通用上界函数
   * 会重新枚举全部约束；此处指标类型固定，只读取指标实际依赖的一个或两个
   * 面板字段，并沿用同样的最大值截断规则。
   */
  const constrainedUpperBoundForRemaining = (
    stats: StatBag,
    future: StatBag,
    potentialBonus: StatBag,
  ): number => {
    const upperPanelValue = (key: PanelConstraintKey): number => {
      const value = panelValueForState(stats, key, future, potentialBonus);
      const maximum = filters.panelConstraints?.[key]?.max;
      return maximum === undefined ? value : Math.min(value, maximum);
    };
    if (metric === "damage")
      return upperPanelValue("attack") * upperPanelValue("critDamage") * 0.01;
    if (metric === "healing")
      return upperPanelValue("health") * upperPanelValue("critDamage") * 0.01;
    if (metric === "defenseOutput")
      return upperPanelValue("defense") * upperPanelValue("critDamage") * 0.01;
    if (metric === "hitResistance")
      return upperPanelValue("effectHit") + upperPanelValue("effectResistance");
    return upperPanelValue(metric);
  };
  const cannotBeatRemainingResult = (
    stats: StatBag,
    future: StatBag,
    potentialBonus: StatBag,
    scoreFloor: number,
  ): boolean =>
    cannotSatisfyRemainingConstraints(stats, future, potentialBonus) ||
    constrainedUpperBoundForRemaining(stats, future, potentialBonus) <
      scoreFloor;
  const potentialTwoPieceStatsCache = new Map<string, StatBag>();
  const patternCandidateCache =
    sharedPatternCandidateCache || new Map<string, PatternCandidateSet>();
  // 六个位置固定四件后，普通御魂最多只会触发两组两件套属性：
  // 固定四件套自身的一组，以及剩余两个位置的一组。使用更紧的安全上界
  // 能让极速模式更早排除无论如何都无法超过当前第一名的布局。
  const getPatternCandidates = (
    positionIndex: number,
    isFourPiece: boolean,
    twoPieceName: string | undefined,
  ) => {
    const key = `${positionIndex}:${isFourPiece ? "four" : twoPieceName || "all"}`;
    const cached = patternCandidateCache.get(key);
    if (cached) return cached;

    const matching = matchingRelics(positionIndex, isFourPiece, twoPieceName);
    const matchingSuitName = isFourPiece ? fixedSuitName : twoPieceName;
    let undominated: RelicView[];
    if (matchingSuitName) {
      const allKey = `${positionIndex}:all`;
      let allCandidateSet = patternCandidateCache.get(allKey);
      if (!allCandidateSet) {
        // 在完整号位集合中，支配比较只发生在同一套装内；因此先裁剪全部套装
        // 再筛选具体套装，与直接裁剪该套装的结果和原始相对顺序完全一致。
        allCandidateSet = getPatternCandidates(positionIndex, false, undefined);
      }
      undominated = allCandidateSet.undominated.filter(
        (relic) => relic.suit?.name === matchingSuitName,
      );
    } else {
      undominated = deps.removeDominatedRelics(matching, metric, filters, base);
    }
    const candidateSet = {
      candidates: deps.fixedPatternCandidates(
        undominated,
        positionIndex,
        base,
        metric,
        filters,
      ),
      matchingCount: matching.length,
      undominated,
    };
    patternCandidateCache.set(key, candidateSet);
    return candidateSet;
  };
  // 每种四件套号位分配的候选数量不同。分母按实际会遍历到的御魂计算，
  // 但这里只统计套装归属，不能为了计算分母就提前构造 15 种布局的所有
  // 候选排序。后者会让第一条 Worker 进度消息被长时间阻塞在预处理阶段。
  const totalRelics = plan.totalRelics;
  let lastPreviewAt = 0;
  const reportProgress = (
    includeResults = false,
    stage: CalculatorProgressStage = "matching",
    processedOverride = processedRelics,
  ) => {
    // 进度消息只负责让页面展示实时预览。完整结果会在 Worker 完成时单独
    // 返回；若每种布局都复制上百条六件套组合到主线程，移动端的结构化克隆
    // 与 React 合并排序会显著拖慢真正的计算。
    const now = performance.now();
    const shouldIncludeResults =
      includeResults &&
      // 实时预览会跨 Worker 克隆完整六件御魂对象。极速模式只需要最终第一名，
      // 因此同样节流，避免移动端把时间耗在消息传递和 React 合并上。
      (now - lastPreviewAt >= 180 || lastPreviewAt === 0);
    if (shouldIncludeResults) lastPreviewAt = now;
    const previewLimit = filters.fastMode ? 1 : Math.min(5, resultLimit);
    progress?.({
      processedRelics: Math.min(processedOverride, totalRelics),
      totalRelics,
      stage,
      ...(shouldIncludeResults
        ? {
            results: filters.fastMode
              ? fastBestResult
                ? [fastBestResult]
                : []
              : deps.prioritizeResults(
                  [...results],
                  filters,
                  metric,
                  previewLimit,
                ),
          }
        : {}),
    });
  };
  // 在候选准备开始前先发布固定的总量，让某个 Worker 提前产出结果时，
  // 进度仍保持线性，不会因为其他 Worker 尚未发送首条消息而回退。
  reportProgress(false, "preparing", 0);
  patternVariants.forEach(({ pattern, twoPieceName }) => {
    const patternProgressBase = processedRelics;
    const potentialKey = `${fixedPieceCount}:${twoPieceName || "all"}`;
    let potentialTwoPieceStats = potentialTwoPieceStatsCache.get(potentialKey);
    if (!potentialTwoPieceStats) {
      potentialTwoPieceStats = deps.potentialFixedSuitTwoPieceStats(
        filters,
        fixedSuitName,
        fixedPieceCount,
        twoPieceName,
      );
      potentialTwoPieceStatsCache.set(potentialKey, potentialTwoPieceStats);
    }
    const layoutKnownSuitSteps = twoPieceName
      ? deps.knownSuitSteps(pattern, fixedSuitName, twoPieceName, filters)
      : deps.knownFixedSuitSteps(pattern, fixedSuitName, filters);
    // 候选集合在计算前已缓存。进度必须在每个号位搜索结束后才累加，否则
    // 首个复杂布局会长时间没有 Worker 消息，页面看起来像卡在第一步。
    const patternCandidateSets: PatternCandidateSet[] = [];
    eligibleRelics.forEach((_items, index) => {
      const candidateSet = getPatternCandidates(
        index,
        pattern[index],
        twoPieceName,
      );
      patternCandidateSets.push(candidateSet);
    });
    // matchingCount 与候选集一起缓存。具体两件套阶段会展开大量布局，不能为了
    // 显示准备进度再次对每个号位做完整 filter 扫描。
    const patternMatchingTotal = patternCandidateSets.reduce(
      (total, candidateSet) => total + candidateSet.matchingCount,
      0,
    );
    reportProgress(
      false,
      "matching",
      patternProgressBase + patternMatchingTotal * 0.08,
    );
    const patternSearchBase = patternProgressBase + patternMatchingTotal * 0.08;
    const patternSearchScale = 0.92;
    const patternCandidates = patternCandidateSets.map(
      (candidateSet) => candidateSet.candidates,
    );
    if (patternCandidates.some((items) => items.length === 0)) {
      processedRelics += patternCandidateSets.reduce(
        (total, candidateSet) => total + candidateSet.matchingCount,
        0,
      );
      reportProgress(false, "matching");
      return;
    }

    const optimisticLayoutStats: StatBag = {};
    patternCandidates.forEach((items) =>
      deps.addStats(optimisticLayoutStats, deps.maximumCandidateStats(items)),
    );
    // 这是严格的面板可行性判断：即使每个位置都取到自身最大词条，
    // 仍无法满足下限时，该布局不可能产生有效结果。
    if (
      hasActivePanelConstraint &&
      cannotBeatRemainingResult(
        {},
        optimisticLayoutStats,
        potentialTwoPieceStats,
        Number.NEGATIVE_INFINITY,
      )
    ) {
      processedRelics += patternCandidateSets.reduce(
        (total, candidateSet) => total + candidateSet.matchingCount,
        0,
      );
      reportProgress(false, "validating");
      return;
    }

    const normalScoreThreshold =
      !filters.fastMode && normalBestResults.length >= resultLimit
        ? normalBestResults.at(-1)?.score
        : undefined;
    // 前 N 已经稳定后，只要当前布局在逐属性最大值的乐观条件下仍无法超过
    // 第 N 名，便不必进入束搜索。上界使用的不是实际组合，因此只会少做
    // 无法进入结果区的布局，不会丢弃可能更高的组合。

    if (
      normalScoreThreshold !== undefined &&
      cannotBeatRemainingResult(
        {},
        optimisticLayoutStats,
        potentialTwoPieceStats,
        normalScoreThreshold,
      )
    ) {
      processedRelics += patternCandidateSets.reduce(
        (total, candidateSet) => total + candidateSet.matchingCount,
        0,
      );
      reportProgress(false, "ranking");
      return;
    }

    if (filters.fastMode && fastBestResult) {
      // 极速模式的整套布局剪枝只使用理论上界：即使每个号位都拿到各自属性
      // 最大的御魂，仍达不到约束或超过不了当前最优结果，才可以安全跳过。
      if (
        cannotBeatRemainingResult(
          {},
          optimisticLayoutStats,
          potentialTwoPieceStats,
          fastBestResult.score,
        )
      ) {
        processedRelics += patternCandidateSets.reduce(
          (total, candidateSet) => total + candidateSet.matchingCount,
          0,
        );
        reportProgress(false, "ranking");
        return;
      }
    }

    // 对每个后续号位保存独立属性最大值之和。它不是一个真实组合，只用于
    // 构造足够宽松的理论上界；所以基于它的剪枝不会影响最终最优解。
    const suffixMaximumStats: StatBag[] = Array.from(
      { length: patternCandidates.length + 1 },
      () => ({}),
    );
    for (let index = patternCandidates.length - 1; index >= 0; index -= 1) {
      const maximum = { ...suffixMaximumStats[index + 1] };
      deps.addStats(
        maximum,
        deps.maximumCandidateStats(patternCandidates[index]),
      );
      suffixMaximumStats[index] = maximum;
    }
    const critRateConstraint = filters.panelConstraints?.critRate;
    const usesCriticalFrontier =
      deps.usesCriticalRateCap(metric) &&
      critRateConstraint?.min !== undefined &&
      critRateConstraint.min > base.critRate;
    let beam: BeamState[] = [
      {
        stats: deps.createEmptyStatBag(),
        // 自由号位若与四件套同名，不能再次触发两件套；预置为四件能确保
        // 后续动态计数只关心那两个自由号位的实际组合。
        suitCounts: twoPieceName ? {} : { [fixedSuitName]: 4 },
      },
    ];
    patternCandidates.forEach((items, index) => {
      const shouldSkipFastState = (stats: StatBag) => {
        // 剩余号位的逐属性最大值都不能补齐约束时，继续扩展没有意义。
        // 该判断只排除数学上不可能合格的状态，普通模式同样可以安全使用。
        if (
          hasActivePanelConstraint &&
          cannotSatisfyRemainingConstraints(
            stats,
            suffixMaximumStats[index + 1],
            potentialTwoPieceStats,
          )
        ) {
          return true;
        }
        if (normalScoreThreshold !== undefined) {
          if (
            cannotBeatRemainingResult(
              stats,
              suffixMaximumStats[index + 1],
              potentialTwoPieceStats,
              normalScoreThreshold,
            )
          ) {
            return true;
          }
        }
        if (!filters.fastMode || !fastBestResult) return false;
        return cannotBeatRemainingResult(
          stats,
          suffixMaximumStats[index + 1],
          potentialTwoPieceStats,
          fastBestResult.score,
        );
      };
      const finalPosition = index === deps.positionCount - 1;
      if (usesCriticalFrontier) {
        const positionProgressBase =
          patternSearchBase +
          (processedRelics - patternProgressBase) * patternSearchScale;
        const positionProgressTotal =
          patternCandidateSets[index].matchingCount * patternSearchScale;
        beam = deps.expandCriticalFixedSuitStates(
          beam,
          items,
          base,
          metric,
          filters,
          finalPosition,
          layoutResultLimit,
          shouldSkipFastState,
          layoutKnownSuitSteps?.[index],
          !twoPieceName && fixedPieceCount === 4,
          fixedSuitName,
          (processed, total) => {
            const partial = total
              ? (positionProgressTotal * processed) / total
              : positionProgressTotal;
            reportProgress(
              false,
              finalPosition ? "validating" : "matching",
              positionProgressBase + partial,
            );
          },
          {
            beamWidth: filters.fastMode
              ? deps.fastFixedSuitBeamWidth
              : deps.fixedSuitBeamWidth,
            bucketWidth: filters.fastMode
              ? deps.fastFixedSuitCritBucketWidth
              : deps.fixedSuitCritBucketWidth,
            constraintBucketCount: filters.fastMode
              ? deps.fastFixedSuitConstraintBucketCount
              : deps.fixedSuitConstraintBucketCount,
            panelFor: deps.panelFor,
            metricValue: deps.metricValue,
            constraintsForSearch: deps.constraintsForSearch,
            panelConstraintProgress: deps.panelConstraintProgress,
            panelConstraintBucketSignature: deps.panelConstraintBucketSignature,
            criticalRateOverflow: deps.criticalRateOverflow,
            usesCriticalRateCap: deps.usesCriticalRateCap,
            satisfiesPanelConstraints: deps.satisfiesPanelConstraints,
            offerBest: deps.offerBest,
            useFastDamageValues: deps.isFastDamageConstraintPath,
            fastDamageValues: deps.fastDamageValues,
          },
        );
        processedRelics += patternCandidateSets[index].matchingCount;
        reportProgress(
          false,
          finalPosition ? "validating" : "matching",
          positionProgressBase + positionProgressTotal,
        );
        return;
      }
      const next: BeamState[] = [];
      const positionProgressBase =
        patternSearchBase +
        (processedRelics - patternProgressBase) * patternSearchScale;
      const positionProgressTotal =
        patternCandidateSets[index].matchingCount * patternSearchScale;
      const totalOperations = beam.length * items.length;
      const progressStep = Math.max(2048, Math.ceil(totalOperations / 100));
      let processedOperations = 0;
      const reportPositionProgress = () => {
        if (
          processedOperations === totalOperations ||
          processedOperations % progressStep === 0
        ) {
          const partial = totalOperations
            ? (positionProgressTotal * processedOperations) / totalOperations
            : positionProgressTotal;
          reportProgress(
            false,
            finalPosition ? "validating" : "matching",
            positionProgressBase + partial,
          );
        }
      };
      // 非满暴击路径同样会展开大量状态。这里使用索引循环保留原有顺序，
      // 仅移除嵌套 forEach 的回调开销，候选和剪枝条件完全不变。
      for (let stateIndex = 0; stateIndex < beam.length; stateIndex += 1) {
        const state = beam[stateIndex];
        for (let relicIndex = 0; relicIndex < items.length; relicIndex += 1) {
          const relic = items[relicIndex];
          processedOperations += 1;
          const nextState = layoutKnownSuitSteps?.[index]
            ? deps.extendKnownSuitState(
                state,
                relic,
                layoutKnownSuitSteps[index],
              )
            : !twoPieceName && fixedPieceCount === 4
              ? deps.extendUnrestrictedFixedSuitState(
                  state,
                  relic,
                  filters,
                  fixedSuitName,
                )
              : deps.extendFixedSuitState(state, relic, filters);
          if (shouldSkipFastState(nextState.stats)) {
            reportPositionProgress();
            continue;
          }
          next.push(nextState);
          reportPositionProgress();
        }
      }
      beam = deps.retainFixedSuitStates(
        next,
        base,
        metric,
        filters,
        finalPosition,
        layoutResultLimit,
        {
          beamWidth: filters.fastMode
            ? deps.fastFixedSuitBeamWidth
            : deps.fixedSuitBeamWidth,
          stateReserve: filters.fastMode ? deps.fastFixedSuitStateReserve : 72,
          critBucketWidth: filters.fastMode
            ? deps.fastFixedSuitCritBucketWidth
            : deps.fixedSuitCritBucketWidth,
          constraintBucketCount: filters.fastMode
            ? deps.fastFixedSuitConstraintBucketCount
            : deps.fixedSuitConstraintBucketCount,
          panelFor: deps.panelFor,
          metricValue: deps.metricValue,
          satisfiesPanelConstraints: deps.satisfiesPanelConstraints,
          constraintsForSearch: deps.constraintsForSearch,
          panelConstraintProgress: deps.panelConstraintProgress,
          panelConstraintBucketSignature: deps.panelConstraintBucketSignature,
          compareCriticalOverflow: deps.compareCriticalOverflow,
          usesCriticalRateCap: deps.usesCriticalRateCap,
          takeBest: deps.takeBest,
        },
      );
      processedRelics += patternCandidateSets[index].matchingCount;
      reportProgress(
        false,
        finalPosition ? "validating" : "matching",
        positionProgressBase + positionProgressTotal,
      );
    });
    const patternResults = beam
      .map((state) => deps.resultForState(state, base, metric))
      .filter((result) =>
        deps.satisfiesPanelConstraints(result.panel, filters.panelConstraints),
      );
    if (filters.fastMode) {
      const [bestResult] = deps.prioritizeResults(
        [fastBestResult, ...patternResults].filter(
          (result): result is CalculatorResult => Boolean(result),
        ),
        filters,
        metric,
        1,
      );
      fastBestResult = bestResult;
    } else {
      results.push(...patternResults);
      if (patternResults.length) {
        normalBestResults = deps.prioritizeResults(
          [...normalBestResults, ...patternResults],
          filters,
          metric,
          resultLimit,
        );
      }
    }
    reportProgress(true, "ranking", patternProgressBase + patternMatchingTotal);
  });

  if (filters.fastMode) return fastBestResult ? [fastBestResult] : [];
  return deps.prioritizeResults(
    [...initialNormalBestResults, ...results],
    filters,
    metric,
    resultLimit,
  );
}
