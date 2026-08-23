import type { RelicView } from "../../types";
import type { CalculatorFilters } from "./types";
import { addAttribute, cloneStatsWithRelic, type StatBag } from "./relicStats";
import { parseTwoPieceAttribute } from "./setRules";

export type SuitCounts = Readonly<Record<string, number>>;
export type RelicChain = {
  relic: RelicView;
  previous?: RelicChain;
};
export type BeamState = {
  relics?: RelicChain;
  stats: StatBag;
  suitCounts: SuitCounts;
  /** 全覆盖四件套路径中，首件自由号位的套装名。 */
  firstFreeSuitName?: string;
};
export type KnownSuitStep = {
  suitCounts: SuitCounts;
  twoPieceBonus?: RelicView["mainAttribute"];
  skipTwoPieceBonusWhenRelicHasSetBonus?: boolean;
  /**
   * 固定四件套与两个自由格混合时，固定套的计数已在初始状态中占位。
   * 该标记让固定套号位复用自由格已经记录的套装计数，避免每件固定套
   * 都复制一份仅用于计数的对象。
   */
  preserveStateSuitCounts?: boolean;
};

export function relicsForState(state: BeamState): RelicView[] {
  const relics: RelicView[] = [];
  let current = state.relics;
  while (current) {
    relics.push(current.relic);
    current = current.previous;
  }
  return relics.reverse();
}

export function extendFixedSuitState(
  state: BeamState,
  relic: RelicView,
  filters: CalculatorFilters,
): BeamState {
  const stats = cloneStatsWithRelic(state.stats, relic);
  const suit = relic.suit?.name || "";
  let suitCounts = state.suitCounts;
  if (suit) {
    const currentCount = suitCounts[suit] || 0;
    const nextCount = currentCount + 1;
    /**
     * 四件效果已触发的套装再放入第五、第六件时，不会产生新的两件套效果；
     * 搜索只关心四件阈值和两件阈值，继续把 4 复制为 5、6 只是额外分配。
     */
    if (currentCount < 4) {
      suitCounts = { ...suitCounts, [suit]: nextCount };
    }
    if (nextCount === 2 && !relic.setBonusAttribute) {
      addAttribute(
        stats,
        parseTwoPieceAttribute(filters.suitTwoPieceAttributes?.get(suit)),
      );
    }
  }
  return { relics: { relic, previous: state.relics }, stats, suitCounts };
}

/**
 * 四件固定套的全覆盖搜索只有两个自由号位。固定四件套的两件套效果已在已知
 * 步骤中加入，两个自由格只有同套时才会再触发一组两件套。因此不需要为每个
 * 候选复制套装计数字典，只记录首件自由格套装并在第二件时比较即可。
 */
export function extendUnrestrictedFixedSuitState(
  state: BeamState,
  relic: RelicView,
  filters: CalculatorFilters,
  fixedSuitName: string,
): BeamState {
  const stats = cloneStatsWithRelic(state.stats, relic);
  const suitName = relic.suit?.name || "";
  if (
    state.firstFreeSuitName !== undefined &&
    suitName === state.firstFreeSuitName &&
    suitName !== fixedSuitName &&
    !relic.setBonusAttribute
  ) {
    addAttribute(
      stats,
      parseTwoPieceAttribute(filters.suitTwoPieceAttributes?.get(suitName)),
    );
  }
  return {
    relics: { relic, previous: state.relics },
    stats,
    suitCounts: state.suitCounts,
    firstFreeSuitName:
      state.firstFreeSuitName === undefined
        ? suitName
        : state.firstFreeSuitName,
  };
}

export function knownSuitSteps(
  pattern: readonly boolean[],
  fixedSuitName: string,
  twoPieceName: string,
  filters: CalculatorFilters,
): KnownSuitStep[] {
  let counts: SuitCounts = {};
  return pattern.map((isFourPiece) => {
    const suitName = isFourPiece ? fixedSuitName : twoPieceName;
    const count = (counts[suitName] || 0) + 1;
    counts = { ...counts, [suitName]: count };
    return {
      suitCounts: counts,
      twoPieceBonus:
        count === 2
          ? parseTwoPieceAttribute(
              filters.suitTwoPieceAttributes?.get(suitName),
            )
          : undefined,
    };
  });
}

/**
 * 未指定具体两件套时，四件套的四个号位不需要反复维护其计数；真正会影响
 * 后续两件套触发的只有两个自由号位。固定套的第二件仍在这里精确补上两件套
 * 属性，以保持与逐件计数完全相同的最终效果。
 */
export function knownFixedSuitSteps(
  pattern: readonly boolean[],
  fixedSuitName: string,
  filters: CalculatorFilters,
): Array<KnownSuitStep | undefined> {
  let fixedCount = 0;
  return pattern.map((isFourPiece) => {
    if (!isFourPiece) return undefined;
    fixedCount += 1;
    return {
      suitCounts: { [fixedSuitName]: 4 },
      twoPieceBonus:
        fixedCount === 2
          ? parseTwoPieceAttribute(
              filters.suitTwoPieceAttributes?.get(fixedSuitName),
            )
          : undefined,
      preserveStateSuitCounts: true,
      skipTwoPieceBonusWhenRelicHasSetBonus: true,
    };
  });
}

export function extendKnownSuitState(
  state: BeamState,
  relic: RelicView,
  step: KnownSuitStep,
): BeamState {
  const stats = cloneStatsWithRelic(state.stats, relic);
  if (!step.skipTwoPieceBonusWhenRelicHasSetBonus || !relic.setBonusAttribute) {
    addAttribute(stats, step.twoPieceBonus);
  }
  return {
    relics: { relic, previous: state.relics },
    stats,
    suitCounts: step.preserveStateSuitCounts
      ? state.suitCounts
      : step.suitCounts,
    firstFreeSuitName: state.firstFreeSuitName,
  };
}
