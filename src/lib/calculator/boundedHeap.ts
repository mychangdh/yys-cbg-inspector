type HeapCompare<T> = (left: T, right: T) => number;

/**
 * 堆顶保存当前最差项。该函数位于模块级，避免满暴击前沿每放入一个候选
 * 就创建一次调整堆的闭包；堆比较规则和原实现完全一致。
 */
function siftWorstUp<T>(
  target: T[],
  startIndex: number,
  compare: HeapCompare<T>,
): void {
  let child = startIndex;
  while (child > 0) {
    const parent = Math.floor((child - 1) / 2);
    if (compare(target[child], target[parent]) <= 0) return;
    const parentValue = target[parent];
    target[parent] = target[child];
    target[child] = parentValue;
    child = parent;
  }
}

/** 保持最差项位于堆顶，以便固定容量时快速淘汰它。 */
function siftWorstDown<T>(
  target: T[],
  startIndex: number,
  compare: HeapCompare<T>,
): void {
  let parent = startIndex;
  while (true) {
    const left = parent * 2 + 1;
    const right = left + 1;
    let worst = parent;
    if (left < target.length && compare(target[left], target[worst]) > 0)
      worst = left;
    if (right < target.length && compare(target[right], target[worst]) > 0)
      worst = right;
    if (worst === parent) return;
    const parentValue = target[parent];
    target[parent] = target[worst];
    target[worst] = parentValue;
    parent = worst;
  }
}

/**
 * 固定容量的最优前沿。
 *
 * 堆顶始终为当前最差项；compare 的负值表示左项优于右项。
 * 搜索分桶只保留有限候选，以此避免构造巨大的中间状态数组。
 */
export function offerBest<T>(
  target: T[],
  candidate: T,
  limit: number,
  compare: HeapCompare<T>,
): void {

  if (target.length < limit) {
    target.push(candidate);
    siftWorstUp(target, target.length - 1, compare);
    return;
  }
  if (target.length && compare(candidate, target[0]) < 0) {
    target[0] = candidate;
    siftWorstDown(target, 0, compare);
  }
}
