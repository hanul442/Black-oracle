import { buildUpbitKrwUniverse, type UpbitKrwUniverseSnapshot, type UpbitMarketDescriptor } from './upbitKrwUniverse';
import { evaluateUniverseFreshness, type UniverseFreshnessDecision } from './upbitUniverseFreshness';

export const UPBIT_MARKET_ALL_URL = 'https://api.upbit.com/v1/market/all?is_details=true';

export interface UpbitPublicMarketCollectorResult {
  snapshot: UpbitKrwUniverseSnapshot | null;
  lastGoodSnapshot: UpbitKrwUniverseSnapshot | null;
  freshness: UniverseFreshnessDecision | null;
  scannerEligible: boolean;
  error: string | null;
}

export type PublicMarketFetch = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * Read-only Upbit public market collector for BOT discovery.
 * Network or payload failures fail closed. A last-good snapshot is returned only for
 * observability/audit; it never becomes scanner-eligible unless it independently passes
 * the freshness gate at evaluation time.
 */
export const collectUpbitPublicMarketUniverse = async (
  fetchMarket: PublicMarketFetch,
  now: Date = new Date(),
  lastGoodSnapshot: UpbitKrwUniverseSnapshot | null = null,
): Promise<UpbitPublicMarketCollectorResult> => {
  try {
    const response = await fetchMarket(UPBIT_MARKET_ALL_URL);
    if (!response.ok) throw new Error(`UPBIT_HTTP_${response.status}`);

    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error('UPBIT_INVALID_MARKET_PAYLOAD');

    const snapshot = buildUpbitKrwUniverse(payload as UpbitMarketDescriptor[], now);
    const freshness = evaluateUniverseFreshness(snapshot, now);
    return {
      snapshot,
      lastGoodSnapshot: freshness.usable ? snapshot : lastGoodSnapshot,
      freshness,
      scannerEligible: freshness.usable,
      error: null,
    };
  } catch (error) {
    const freshness = lastGoodSnapshot ? evaluateUniverseFreshness(lastGoodSnapshot, now) : null;
    return {
      snapshot: null,
      lastGoodSnapshot,
      freshness,
      scannerEligible: false,
      error: error instanceof Error ? error.message : 'UPBIT_COLLECTOR_UNKNOWN_ERROR',
    };
  }
};
