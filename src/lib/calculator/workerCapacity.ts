/**
 * 浏览器无法读取实时空闲内存，deviceMemory 也只是粗略提示，因此必须使用
 * 比桌面端更保守的 Worker 上限，避免移动端复制多个御魂仓库后被系统回收。
 */
export function browserWorkerLimit(
  logicalCores: number,
  deviceMemory: number | undefined,
  isMobile: boolean,
): number {
  const cores = Math.max(1, Math.floor(logicalCores || 1));
  const cpuLimit = Math.max(1, Math.floor(cores * (isMobile ? 0.5 : 0.67)));
  const memoryLimit =
    deviceMemory === undefined
      ? isMobile
        ? 2
        : 4
      : deviceMemory <= 4
        ? 1
        : deviceMemory <= 8
          ? 2
          : deviceMemory <= 16
            ? 4
            : 6;
  return Math.max(1, Math.min(cpuLimit, memoryLimit, isMobile ? 4 : 6));
}
