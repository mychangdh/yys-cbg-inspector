export type ComputeCapacity = {
  logicalCores: number;
  totalMemoryMb: number;
  freeMemoryMb: number;
};

/**
 * Worker 之间不会共享候选数组与搜索状态，内存压力通常比 CPU 更早成为瓶颈。
 * 因此优先按照实时空闲内存限流，再用逻辑核心数避免将系统调度线程全部占满。
 */
export function workerLimitForCapacity(capacity: ComputeCapacity): number {
  const cores = Math.max(1, Math.floor(capacity.logicalCores || 1));
  const freeMemoryMb = Math.max(0, Math.floor(capacity.freeMemoryMb || 0));
  const totalMemoryMb = Math.max(0, Math.floor(capacity.totalMemoryMb || 0));

  const cpuLimit = Math.max(1, Math.floor(cores * 0.67));
  const memoryLimit =
    freeMemoryMb < 2_048
      ? 1
      : freeMemoryMb < 4_096
        ? 2
        : freeMemoryMb < 8_192
          ? 4
          : freeMemoryMb < 16_384
            ? 6
            : 8;
  const machineLimit =
    totalMemoryMb > 0 && totalMemoryMb <= 8_192
      ? 4
      : totalMemoryMb > 0 && totalMemoryMb <= 16_384
        ? 6
        : 8;

  return Math.max(1, Math.min(cpuLimit, memoryLimit, machineLimit, 8));
}

/**
 * 固定四件套的每个 Worker 都必须接收一份完整御魂数据，并在自己的线程内建立
 * 候选缓存。仓库规模较大时，继续增加 Worker 会让结构化克隆、JIT 预热和 GC
 * 同时放大，实际吞吐反而下降。
 *
 * 这里仅决定并发数量，不会删减任何御魂、布局或两件套分支，因此不会改变结果
 * 空间。分档以计算前的全仓库数量为准，避免筛选条件较宽时意外启动过多副本。
 */
export function workerLimitForRelicCount(
  capacityLimit: number,
  totalRelics: number,
): number {
  const normalizedCapacity = Math.max(1, Math.floor(capacityLimit || 1));
  const normalizedRelics = Math.max(0, Math.floor(totalRelics || 0));

  if (normalizedRelics >= 10_000) return Math.min(normalizedCapacity, 2);
  if (normalizedRelics >= 7_500) return Math.min(normalizedCapacity, 3);
  // 5000-7499 件是常见的大仓库档位。四个 Worker 会让 12 核桌面机
  // 长时间闲置；五个副本仍低于 16GB 设备的容量上限，同时能更均衡地分摊
  // 固定四件套的 15 种布局，不影响任意一个布局的搜索空间。
  if (normalizedRelics >= 5_000) return Math.min(normalizedCapacity, 5);
  if (normalizedRelics >= 4_000) return Math.min(normalizedCapacity, 6);
  return normalizedCapacity;
}
