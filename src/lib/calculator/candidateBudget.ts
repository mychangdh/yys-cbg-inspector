/**
 * 根据当前仓库规模给普通搜索分配候选预算。
 *
 * 候选越多时适度扩大每个号位的保留窗口，减少高价值御魂被局部排序截断的概率；
 * 上限同时限制 Beam 的组合规模。关闭智能计算时不会使用这份预算。
 */
export function candidateLimitForTotalRelics(totalRelics: number): number {
  const normalizedTotal = Math.max(0, Math.floor(totalRelics));
  const growth = Math.max(0, Math.floor(Math.log2(Math.max(1, normalizedTotal) / 64)));
  return Math.min(128, 64 + growth * 8);
}

/** 固定四件套布局需要更宽的候选池；与原生端使用完全相同的公式。 */
export function fixedPatternCandidateLimitForTotalRelics(
  totalRelics: number,
): number {
  const normalizedTotal = Math.max(0, Math.floor(totalRelics));
  const growth = Math.max(
    0,
    Math.floor(Math.log2(Math.max(1, normalizedTotal) / 64)),
  );
  return Math.min(512, 360 + growth * 8);
}
