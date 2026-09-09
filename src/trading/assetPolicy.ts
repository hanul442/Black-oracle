import { findTradingInstrument, type AssetClass } from './assets';

export interface AssetDecisionPolicy {
  assetClass: AssetClass | 'UNKNOWN';
  technicalWeight: number;
  evidenceWeight: number;
  evidenceRequiredForNewRisk: boolean;
  evidenceRequestOnGap: boolean;
  rationale: string[];
}

const POLICY_BY_ASSET: Record<AssetClass, AssetDecisionPolicy> = {
  CRYPTO_SPOT: {
    assetClass: 'CRYPTO_SPOT',
    technicalWeight: 0.9,
    evidenceWeight: 0.1,
    evidenceRequiredForNewRisk: false,
    evidenceRequestOnGap: false,
    rationale: [
      'Crypto spot is technical-first: price structure, trend, momentum, volatility and liquidity drive entry authority.',
      'External evidence is supplementary context and may adjust conviction, but absence of evidence does not block Paper entry.',
    ],
  },
  CRYPTO_PERP: {
    assetClass: 'CRYPTO_PERP',
    technicalWeight: 0.85,
    evidenceWeight: 0.15,
    evidenceRequiredForNewRisk: false,
    evidenceRequestOnGap: false,
    rationale: [
      'Crypto perpetuals remain technical/market-structure first.',
      'Derivatives positioning inputs such as funding, open interest and liquidation flow should carry more weight than news evidence.',
    ],
  },
  EQUITY: {
    assetClass: 'EQUITY',
    technicalWeight: 0.45,
    evidenceWeight: 0.55,
    evidenceRequiredForNewRisk: true,
    evidenceRequestOnGap: true,
    rationale: [
      'Equity entries require both market/technical support and source-backed company or market evidence.',
      'DART filings, company disclosures, earnings/financial data, material news and macro/sector evidence are first-class inputs.',
    ],
  },
};

const UNKNOWN_POLICY: AssetDecisionPolicy = {
  assetClass: 'UNKNOWN',
  technicalWeight: 0.5,
  evidenceWeight: 0.5,
  evidenceRequiredForNewRisk: true,
  evidenceRequestOnGap: true,
  rationale: ['Unknown asset classes default to conservative evidence-required behavior until explicitly configured.'],
};

const clonePolicy = (policy: AssetDecisionPolicy): AssetDecisionPolicy => ({ ...policy, rationale: policy.rationale.slice() });

export const inferAssetClassFromMarket = (marketOrId: string): AssetClass | 'UNKNOWN' => {
  const instrument = findTradingInstrument(marketOrId);
  if (instrument) return instrument.assetClass;
  const normalized = marketOrId.trim().toUpperCase();
  if (/^KRX-\d{6}$/.test(normalized)) return 'EQUITY';
  if (/^KRW-[A-Z0-9]+$/.test(normalized)) return 'CRYPTO_SPOT';
  return 'UNKNOWN';
};

export const getAssetDecisionPolicy = (marketOrId: string): AssetDecisionPolicy => {
  const assetClass = inferAssetClassFromMarket(marketOrId);
  if (assetClass === 'UNKNOWN') return clonePolicy(UNKNOWN_POLICY);
  return clonePolicy(POLICY_BY_ASSET[assetClass]);
};

export const assetDecisionPolicies = () => Object.values(POLICY_BY_ASSET).map(clonePolicy);
