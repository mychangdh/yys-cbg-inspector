import type { RelicView } from "@/types";
import { calculatePanelFromStats, calculatePanelMetric } from "./panel";
import type { CalculatorMetric } from "./types";
import { addRelic, type StatBag } from "./relicStats";
import type { BaseStatsWithBuffs } from "./searchUpperBounds";

const localScoreCache = new WeakMap<
  RelicView,
  WeakMap<BaseStatsWithBuffs, Map<CalculatorMetric, number>>
>();

/** 计算单件御魂对当前指标的局部贡献，并按基础面板缓存。 */
export function localScore(
  relic: RelicView,
  metric: CalculatorMetric,
  base: BaseStatsWithBuffs,
): number {
  const cachedByBase = localScoreCache.get(relic);
  const cachedScores = cachedByBase?.get(base);
  const cached = cachedScores?.get(metric);
  if (cached !== undefined) return cached;

  const stats: StatBag = {};
  addRelic(stats, relic);
  const panel = calculatePanelFromStats(base, stats);
  const score = calculatePanelMetric(panel, metric);
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
    localScoreCache.set(relic, scoresByBase);
  }
  return score;
}
