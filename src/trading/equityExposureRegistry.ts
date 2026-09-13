export type EquityExposureStatus = 'CLEAR' | 'CRYPTO_LINKED' | 'UNKNOWN';
export type ExposureSourceType = 'PRIMARY' | 'FILING' | 'OFFICIAL_PROFILE' | 'CURATED_RESEARCH' | 'SYSTEM';

export interface EquityExposureRecord {
  market: string;
  status: Exclude<EquityExposureStatus, 'UNKNOWN'>;
  reasons: string[];
  sourceType: ExposureSourceType;
  sourceId: string;
  observedAt: number;
  expiresAt: number;
  confidence: number;
}

export interface EquityExposureResolution {
  market: string;
  status: EquityExposureStatus;
  cryptoLinked: boolean | null;
  confidence: number;
  sourceIds: string[];
  reasons: string[];
  dataGaps: string[];
}

const MARKET = /^KRX-\d{6}$/;
const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export const validateEquityExposureRecord = (record: EquityExposureRecord) => {
  const errors: string[] = [];
  if (!MARKET.test(record.market)) errors.push('market must be KRX-######.');
  if (!record.reasons.length || record.reasons.some((reason) => !reason.trim())) errors.push('At least one non-empty reason is required.');
  if (!record.sourceId.trim()) errors.push('sourceId is required.');
  if (!Number.isFinite(record.observedAt) || !Number.isFinite(record.expiresAt) || record.expiresAt <= record.observedAt) errors.push('expiresAt must be after observedAt.');
  if (!Number.isFinite(record.confidence) || record.confidence < 0 || record.confidence > 1) errors.push('confidence must be in [0,1].');
  return { valid: errors.length === 0, errors };
};

export class EquityExposureRegistry {
  private readonly records = new Map<string, EquityExposureRecord[]>();

  upsert(record: EquityExposureRecord) {
    const normalized = { ...record, market: record.market.toUpperCase(), reasons: record.reasons.slice(), confidence: clamp01(record.confidence) };
    const validation = validateEquityExposureRecord(normalized);
    if (!validation.valid) throw new Error(validation.errors.join(' '));
    const existing = this.records.get(normalized.market) ?? [];
    const withoutSameSource = existing.filter((item) => item.sourceId !== normalized.sourceId);
    withoutSameSource.push(normalized);
    this.records.set(normalized.market, withoutSameSource);
    return { ...normalized, reasons: normalized.reasons.slice() };
  }

  resolve(market: string, asOf = Date.now()): EquityExposureResolution {
    const normalized = market.toUpperCase();
    const active = (this.records.get(normalized) ?? []).filter((item) => item.observedAt <= asOf && item.expiresAt > asOf);
    if (!active.length) {
      return {
        market: normalized,
        status: 'UNKNOWN',
        cryptoLinked: null,
        confidence: 0,
        sourceIds: [],
        reasons: [],
        dataGaps: ['No active source-backed company exposure classification is available.'],
      };
    }

    const crypto = active.filter((item) => item.status === 'CRYPTO_LINKED');
    const clear = active.filter((item) => item.status === 'CLEAR');
    const strongestCrypto = crypto.sort((a, b) => b.confidence - a.confidence)[0];
    const strongestClear = clear.sort((a, b) => b.confidence - a.confidence)[0];

    if (strongestCrypto && (!strongestClear || strongestCrypto.confidence >= strongestClear.confidence)) {
      return {
        market: normalized,
        status: 'CRYPTO_LINKED',
        cryptoLinked: true,
        confidence: strongestCrypto.confidence,
        sourceIds: active.map((item) => item.sourceId),
        reasons: crypto.flatMap((item) => item.reasons),
        dataGaps: strongestClear ? ['Conflicting CLEAR classification exists and must be reviewed.'] : [],
      };
    }

    if (strongestClear) {
      return {
        market: normalized,
        status: 'CLEAR',
        cryptoLinked: false,
        confidence: strongestClear.confidence,
        sourceIds: active.map((item) => item.sourceId),
        reasons: clear.flatMap((item) => item.reasons),
        dataGaps: strongestCrypto ? ['Conflicting CRYPTO_LINKED classification exists and must be reviewed.'] : [],
      };
    }

    return {
      market: normalized,
      status: 'UNKNOWN',
      cryptoLinked: null,
      confidence: 0,
      sourceIds: active.map((item) => item.sourceId),
      reasons: [],
      dataGaps: ['Active exposure records did not resolve to a usable classification.'],
    };
  }

  list(market?: string) {
    const normalized = market?.toUpperCase();
    return [...this.records.entries()]
      .filter(([key]) => !normalized || key === normalized)
      .flatMap(([, items]) => items.map((item) => ({ ...item, reasons: item.reasons.slice() })));
  }
}
