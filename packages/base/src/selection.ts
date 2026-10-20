/** Select requested ranks by independently authored, bounded partitioning of an index array. */
export function selectRanks(
  indices: number[],
  ranks: readonly number[],
  compare: (left: number, right: number) => number,
  checkWork: () => void,
): void {
  const positions = [...new Set(ranks)].sort((left, right) => {
    checkWork();
    return left - right;
  });
  const pending = [{ first: 0, end: positions.length, low: 0, high: indices.length - 1 }];
  while (pending.length > 0) {
    checkWork();
    const range = pending.pop()!;
    if (range.first >= range.end || range.low >= range.high) continue;
    const middle = Math.floor((range.first + range.end) / 2);
    const rank = positions[middle]!;
    let low = range.low;
    let high = range.high;
    while (low < high) {
      checkWork();
      const pivot = indices[rank]!;
      let left = low;
      let right = high;
      while (left <= right) {
        checkWork();
        while (compare(indices[left]!, pivot) < 0) left += 1;
        while (compare(indices[right]!, pivot) > 0) right -= 1;
        if (left <= right) {
          [indices[left], indices[right]] = [indices[right]!, indices[left]!];
          left += 1;
          right -= 1;
        }
      }
      if (right < rank) low = left;
      if (rank < left) high = right;
    }
    pending.push(
      { first: middle + 1, end: range.end, low: rank + 1, high: range.high },
      { first: range.first, end: middle, low: range.low, high: rank - 1 },
    );
  }
}
