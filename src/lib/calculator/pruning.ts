import type { RelicView } from "@/types";
import type {
  CalculatedPanel,
  CalculatorFilters,
  CalculatorMetric,
  HeroBaseStats,
  PanelConstraintKey,
} from "./types";
import {
  addAttribute,
  addStats,
  canonical,
  createEmptyStatBag,
  relicStatValue,
  relicStatVectorFor,
  STAT_VECTOR_KEYS,
  type StatBag,
} from "./relicStats";
import { parseTwoPieceAttribute } from "./setRules";

export type RelicScore = (relic: RelicView) => number;

export function statKeysForPanelKey(key: PanelConstraintKey): string[] {
  if (key === "attack") return ["attackPercent", "attack"];
  if (key === "health") return ["healthPercent", "health"];
  if (key === "defense") return ["defensePercent", "defense"];
  return [key];
}

export function metricStatKeys(metric: CalculatorMetric): string[] {
  if (metric === "damage") return ["attackPercent", "attack", "critDamage"];
  if (metric === "healing") return ["healthPercent", "health", "critDamage"];
  if (metric === "defenseOutput")
    return ["defensePercent", "defense", "critDamage"];
  if (metric === "hitResistance") return ["effectHit", "effectResistance"];
  return statKeysForPanelKey(metric);
}

/** 只移除同号位、同套装且在所有相关维度上被严格覆盖的御魂。 */
export function removeDominatedRelics(
  matching: RelicView[],
  metric: CalculatorMetric,
  filters: CalculatorFilters,
  getScore: RelicScore,
  onProgress?: (processed: number, total: number) => void,
): RelicView[] {
  if (matching.length < 2) return matching;

  const dimensions = new Map<string, boolean | undefined>();
  metricStatKeys(metric).forEach((key) => dimensions.set(key, true));
  Object.entries(filters.panelConstraints || {}).forEach(([rawKey, range]) => {
    statKeysForPanelKey(rawKey as PanelConstraintKey).forEach((key) => {
      const descending = range?.max === undefined;
      const current = dimensions.get(key);
      if (current !== undefined && current !== descending)
        dimensions.set(key, undefined);
      else if (!dimensions.has(key)) dimensions.set(key, descending);
    });
  });
  const keys = [...dimensions].flatMap(([key, descending]) =>
    descending === undefined ? [] : [{ key, descending }],
  );
  const exactKeys = [...dimensions].flatMap(([key, descending]) =>
    descending === undefined ? [key] : [],
  );
  const scores = matching.map(getScore);
  const dominated = new Uint8Array(matching.length);
  const progressStep = Math.max(64, Math.ceil(matching.length / 100));
  const indicesBySuitAndExactValues = new Map<string, number[]>();

  matching.forEach((relic, index) => {
    const suitName = relic.suit?.name || "";
    /**
     * 当“伤害越高越好”和“攻击不能超过上限”同时存在时，攻击不能参与单向
     * 支配比较。它也不是完全不能裁剪：只有攻击相关词条完全相同的两个候选，
     * 才允许继续比较其余词条。精确分组既保留低攻击可行解，也能淘汰真正重复
     * 的低价值候选。
     */
    const exactSignature = exactKeys
      .map((key) => `${key}:${relicStatValue(relic, key)}`)
      .join("|");
    const groupKey = `${suitName}::${exactSignature}`;
    const indices = indicesBySuitAndExactValues.get(groupKey);
    if (indices) indices.push(index);
    else indicesBySuitAndExactValues.set(groupKey, [index]);
  });

  let processedCandidates = 0;
  indicesBySuitAndExactValues.forEach((indices) => {
    /**
     * 支配者的局部分数必须严格更高。先检查低分御魂，并让更高分御魂排在前面，
     * 大多数被支配项在比较少量属性后即可提前结束。原本按输入顺序扫描时，
     * 每个高分御魂都会无意义地检查整个同套集合；六千件仓库会将这一成本放大。
     *
     * 这只是枚举顺序变化：比较条件、套装边界和最终保留集合完全不变。
     */
    const candidateOrder = [...indices].sort(
      (left, right) => scores[left] - scores[right] || left - right,
    );
    const dominatorOrder = [...indices].sort(
      (left, right) => scores[right] - scores[left] || left - right,
    );

    candidateOrder.forEach((candidateIndex) => {
      const candidate = matching[candidateIndex];
      for (const dominatorIndex of dominatorOrder) {
        if (dominatorIndex === candidateIndex) continue;
        if (scores[dominatorIndex] <= scores[candidateIndex]) break;
        const dominator = matching[dominatorIndex];
        const dominates = keys.every(({ key, descending }) => {
          const left = relicStatValue(dominator, key);
          const right = relicStatValue(candidate, key);
          return descending ? left >= right : left <= right;
        });
        if (dominates) {
          dominated[candidateIndex] = 1;
          break;
        }
      }
      processedCandidates += 1;
      if (
        onProgress &&
        (processedCandidates === matching.length ||
          processedCandidates % progressStep === 0)
      ) {
        onProgress(processedCandidates, matching.length);
      }
    });
  });
  return matching.filter((_relic, index) => dominated[index] === 0);
}

const maximumCandidateStatsCache = new WeakMap<RelicView[], StatBag>();

export function maximumCandidateStats(relics: RelicView[]): StatBag {
  const cached = maximumCandidateStatsCache.get(relics);
  if (cached) return cached;
  const maximum = createEmptyStatBag();
  relics.forEach((relic) => {
    const vector = relicStatVectorFor(relic);
    STAT_VECTOR_KEYS.forEach((key, index) => {
      maximum[key] = Math.max(maximum[key], vector[index]);
    });
  });
  maximumCandidateStatsCache.set(relics, maximum);
  return maximum;
}

export function maximumTwoPieceBonusStats(
  filters: CalculatorFilters,
  maximumActiveSetCount = 3,
  excludedSuitNames?: ReadonlySet<string>,
): StatBag {
  const maximum: StatBag = {};
  for (const [suitName, text] of filters.suitTwoPieceAttributes || []) {
    if (excludedSuitNames?.has(suitName)) continue;
    const attribute = parseTwoPieceAttribute(text);
    if (!attribute) continue;
    const key = canonical(attribute.label);
    if (key !== "other")
      maximum[key] = Math.max(maximum[key] || 0, Number(attribute.value || 0));
  }
  Object.entries(maximum).forEach(([key, value]) => {
    maximum[key] = value * maximumActiveSetCount;
  });
  return maximum;
}

export function potentialFixedSuitTwoPieceStats(
  filters: CalculatorFilters,
  fixedSuitName: string,
  fixedPieceCount: 2 | 4,
  twoPieceName?: string,
): StatBag {
  const potential: StatBag = {};
  const fixedSuitNames = new Set([fixedSuitName]);
  addAttribute(
    potential,
    parseTwoPieceAttribute(filters.suitTwoPieceAttributes?.get(fixedSuitName)),
  );
  if (fixedPieceCount === 4) {
    if (twoPieceName) {
      addAttribute(
        potential,
        parseTwoPieceAttribute(
          filters.suitTwoPieceAttributes?.get(twoPieceName),
        ),
      );
      return potential;
    }
    addStats(potential, maximumTwoPieceBonusStats(filters, 1, fixedSuitNames));
    return potential;
  }
  addStats(potential, maximumTwoPieceBonusStats(filters, 2, fixedSuitNames));
  return potential;
}

export function canStillSatisfyConstraints(
  currentPanel: CalculatedPanel,
  optimisticPanel: CalculatedPanel,
  constraints: CalculatorFilters["panelConstraints"],
): boolean {
  return Object.entries(constraints || {}).every(([rawKey, range]) => {
    const key = rawKey as PanelConstraintKey;
    return !(
      (range?.max !== undefined && currentPanel[key] > range.max) ||
      (range?.min !== undefined && optimisticPanel[key] < range.min)
    );
  });
}
