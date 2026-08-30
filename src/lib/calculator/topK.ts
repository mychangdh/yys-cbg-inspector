/**
 * 稳定保留比较器定义下的前 K 项。
 *
 * 当候选数量很大时避免完整排序；相同排序值按原始输入顺序处理，
 * 这是搜索前沿可复现性的组成部分。
 */
export function takeBest<T>(
  items: readonly T[],
  limit: number,
  compare: (left: T, right: T) => number,
): T[] {
  if (limit <= 0 || items.length === 0) return [];

  type IndexedValue = { value: T; index: number };
  const compareIndexed = (left: IndexedValue, right: IndexedValue): number =>
    compare(left.value, right.value) || left.index - right.index;
  if (items.length <= limit) return items.slice().sort(compare);

  const heap: IndexedValue[] = [];
  const isWorse = (left: IndexedValue, right: IndexedValue): boolean =>
    compareIndexed(left, right) > 0;
  const siftUp = (index: number): void => {
    let child = index;
    while (child > 0) {
      const parent = Math.floor((child - 1) / 2);
      if (!isWorse(heap[child], heap[parent])) break;
      [heap[child], heap[parent]] = [heap[parent], heap[child]];
      child = parent;
    }
  };
  const siftDown = (index: number): void => {
    let parent = index;
    while (true) {
      const left = parent * 2 + 1;
      const right = left + 1;
      let worst = parent;
      if (left < heap.length && isWorse(heap[left], heap[worst])) worst = left;
      if (right < heap.length && isWorse(heap[right], heap[worst]))
        worst = right;
      if (worst === parent) break;
      [heap[parent], heap[worst]] = [heap[worst], heap[parent]];
      parent = worst;
    }
  };

  items.forEach((value, index) => {
    const entry = { value, index };
    if (heap.length < limit) {
      heap.push(entry);
      siftUp(heap.length - 1);
    } else if (isWorse(heap[0], entry)) {
      heap[0] = entry;
      siftDown(0);
    }
  });

  return heap
    .slice()
    .sort(compareIndexed)
    .map((entry) => entry.value);
}
