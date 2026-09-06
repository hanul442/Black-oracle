export interface EvidenceCandidateSelectionItem {
  market: string;
  sourceUrl: string;
  title: string;
}

export interface EvidenceCandidateSourceGroup<T extends EvidenceCandidateSelectionItem> {
  id: string;
  items: T[];
}

const candidateKey = (item: EvidenceCandidateSelectionItem) =>
  `${item.market.toUpperCase()}|${item.sourceUrl}|${item.title.trim().toLowerCase()}`;

/**
 * Selects evidence candidates without allowing one broad source (for example a
 * regulator or macro feed replicated across every KRW market) to consume the
 * entire classifier budget.
 *
 * Pass 1 gives every market at most one candidate from every source group.
 * Pass 2 fills remaining capacity round-robin from the second/third items in
 * each market/source bucket. Input order is preserved inside each bucket.
 */
export const selectDiverseEvidenceCandidates = <T extends EvidenceCandidateSelectionItem>(
  markets: string[],
  groups: Array<EvidenceCandidateSourceGroup<T>>,
  maxCandidates = 36,
): T[] => {
  const capacity = Math.max(0, Math.trunc(maxCandidates));
  if (capacity === 0) return [];

  const normalizedMarkets = Array.from(new Set(markets.map((market) => market.toUpperCase())));
  const buckets = groups.map((group) => {
    const byMarket = new Map<string, T[]>();
    const seenInGroup = new Set<string>();
    for (const item of group.items) {
      const market = item.market.toUpperCase();
      if (!normalizedMarkets.includes(market)) continue;
      const key = candidateKey(item);
      if (seenInGroup.has(key)) continue;
      seenInGroup.add(key);
      const bucket = byMarket.get(market) ?? [];
      bucket.push(item);
      byMarket.set(market, bucket);
    }
    return { id: group.id, byMarket };
  });

  const selected: T[] = [];
  const selectedKeys = new Set<string>();
  const cursor = new Map<string, number>();
  const cursorKey = (groupId: string, market: string) => `${groupId}|${market}`;

  const takeOne = (group: (typeof buckets)[number], market: string) => {
    if (selected.length >= capacity) return false;
    const items = group.byMarket.get(market) ?? [];
    const key = cursorKey(group.id, market);
    let index = cursor.get(key) ?? 0;
    while (index < items.length) {
      const item = items[index++];
      cursor.set(key, index);
      const identity = candidateKey(item);
      if (selectedKeys.has(identity)) continue;
      selectedKeys.add(identity);
      selected.push(item);
      return true;
    }
    cursor.set(key, index);
    return false;
  };

  // Diversity pass: one candidate per market/source bucket.
  for (const market of normalizedMarkets) {
    for (const group of buckets) {
      takeOne(group, market);
      if (selected.length >= capacity) return selected;
    }
  }

  // Fill pass: consume additional candidates fairly rather than concatenating
  // entire source arrays in priority order.
  let progressed = true;
  while (selected.length < capacity && progressed) {
    progressed = false;
    for (const market of normalizedMarkets) {
      for (const group of buckets) {
        if (takeOne(group, market)) progressed = true;
        if (selected.length >= capacity) return selected;
      }
    }
  }

  return selected;
};
