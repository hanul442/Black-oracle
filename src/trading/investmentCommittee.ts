import type { TradingHorizon } from './horizonPolicy';

export type CommitteeDesk =
  | 'MARKET'
  | 'SECTOR'
  | 'FUNDAMENTAL'
  | 'QUANT'
  | 'TECHNICAL'
  | 'FLOW'
  | 'EVENT'
  | 'RISK'
  | 'RED_TEAM';

export interface InvestmentCommitteePersona {
  id: string;
  title: string;
  desk: CommitteeDesk;
  strategyFamilies: string[];
  focusSignals: string[];
  preferredHorizons: TradingHorizon[];
  nominationTarget: number;
  vetoDomain?: string[];
}

export const INVESTMENT_COMMITTEE_PERSONAS: InvestmentCommitteePersona[] = [
  { id: 'chief_market', title: 'Chief Market Strategist', desk: 'MARKET', strategyFamilies: ['regime', 'breadth', 'risk appetite'], focusSignals: ['index trend', 'breadth', 'volatility', 'rates', 'FX'], preferredHorizons: ['SHORT', 'MEDIUM', 'MEDIUM_LONG'], nominationTarget: 30 },
  { id: 'sector_rotation', title: 'Sector Rotation PM', desk: 'SECTOR', strategyFamilies: ['relative strength', 'rotation'], focusSignals: ['sector breadth', 'relative strength', 'earnings breadth', 'flow'], preferredHorizons: ['SHORT', 'MEDIUM', 'MEDIUM_LONG'], nominationTarget: 40 },
  { id: 'growth_quality', title: 'Growth & Quality Analyst', desk: 'FUNDAMENTAL', strategyFamilies: ['quality growth', 'earnings momentum'], focusSignals: ['revenue growth', 'margin', 'ROIC', 'earnings revisions'], preferredHorizons: ['MEDIUM', 'MEDIUM_LONG', 'LONG'], nominationTarget: 30 },
  { id: 'deep_value', title: 'Value & Re-rating Analyst', desk: 'FUNDAMENTAL', strategyFamilies: ['deep value', 're-rating'], focusSignals: ['valuation gap', 'cash flow', 'balance sheet', 'catalyst'], preferredHorizons: ['MEDIUM', 'MEDIUM_LONG', 'LONG'], nominationTarget: 30 },
  { id: 'event_catalyst', title: 'Event & Catalyst Analyst', desk: 'EVENT', strategyFamilies: ['event continuation', 'catalyst repricing'], focusSignals: ['filings', 'earnings', 'policy', 'orders', 'corporate actions'], preferredHorizons: ['ULTRA_SHORT', 'SHORT', 'MEDIUM'], nominationTarget: 40 },
  { id: 'news_evidence', title: 'News & Evidence Intelligence', desk: 'EVENT', strategyFamilies: ['evidence surprise', 'narrative diffusion'], focusSignals: ['source quality', 'novelty', 'independence', 'contradiction', 'freshness'], preferredHorizons: ['ULTRA_SHORT', 'SHORT', 'MEDIUM'], nominationTarget: 50 },
  { id: 'trend_momentum', title: 'Trend & Momentum PM', desk: 'TECHNICAL', strategyFamilies: ['trend following', 'momentum'], focusSignals: ['EMA structure', 'MACD', 'ROC', 'breakout', 'relative strength'], preferredHorizons: ['SHORT', 'MEDIUM'], nominationTarget: 50 },
  { id: 'mean_reversion', title: 'Mean Reversion PM', desk: 'TECHNICAL', strategyFamilies: ['mean reversion', 'oversold rebound'], focusSignals: ['RSI', 'stoch RSI', 'Bollinger', 'ATR stretch', 'support'], preferredHorizons: ['ULTRA_SHORT', 'SHORT'], nominationTarget: 40 },
  { id: 'wave_structure', title: 'Wave & Market Structure Analyst', desk: 'TECHNICAL', strategyFamilies: ['wave', 'structure breakout'], focusSignals: ['BOS', 'CHOCH', 'swing structure', 'liquidity sweep'], preferredHorizons: ['SHORT', 'MEDIUM', 'MEDIUM_LONG'], nominationTarget: 40 },
  { id: 'volume_absorption', title: 'Volume & Absorption Analyst', desk: 'FLOW', strategyFamilies: ['volume absorption', 'breakout participation'], focusSignals: ['relative volume', 'absorption', 'VWAP', 'volume profile', 'close location'], preferredHorizons: ['ULTRA_SHORT', 'SHORT', 'MEDIUM'], nominationTarget: 50 },
  { id: 'microstructure', title: 'Microstructure & Execution Analyst', desk: 'FLOW', strategyFamilies: ['microstructure', 'liquidity'], focusSignals: ['spread', 'depth', 'imbalance', 'slippage', 'trade intensity'], preferredHorizons: ['ULTRA_SHORT', 'SHORT'], nominationTarget: 30 },
  { id: 'foreign_institutional', title: 'Foreign & Institutional Flow Analyst', desk: 'FLOW', strategyFamilies: ['ownership flow', 'program flow'], focusSignals: ['foreign net flow', 'institutional net flow', 'program trading', 'block activity'], preferredHorizons: ['SHORT', 'MEDIUM', 'MEDIUM_LONG'], nominationTarget: 40 },
  { id: 'factor_quant', title: 'Factor Quant', desk: 'QUANT', strategyFamilies: ['multi-factor', 'cross-sectional ranking'], focusSignals: ['momentum', 'quality', 'value', 'low volatility', 'size'], preferredHorizons: ['SHORT', 'MEDIUM', 'MEDIUM_LONG'], nominationTarget: 60 },
  { id: 'stat_arb', title: 'Statistical Signals Researcher', desk: 'QUANT', strategyFamilies: ['statistical reversion', 'residual momentum'], focusSignals: ['z-score', 'residual return', 'dispersion', 'correlation break'], preferredHorizons: ['ULTRA_SHORT', 'SHORT', 'MEDIUM'], nominationTarget: 40 },
  { id: 'regime_quant', title: 'Regime Quant', desk: 'QUANT', strategyFamilies: ['regime conditional routing'], focusSignals: ['volatility state', 'trend state', 'breadth regime', 'liquidity regime'], preferredHorizons: ['SHORT', 'MEDIUM', 'MEDIUM_LONG'], nominationTarget: 30 },
  { id: 'earnings_revision', title: 'Earnings Revision Analyst', desk: 'FUNDAMENTAL', strategyFamilies: ['earnings revision momentum'], focusSignals: ['estimate revisions', 'guidance', 'surprise persistence'], preferredHorizons: ['SHORT', 'MEDIUM', 'MEDIUM_LONG'], nominationTarget: 40 },
  { id: 'capex_cycle', title: 'Capex & Industrial Cycle Analyst', desk: 'SECTOR', strategyFamilies: ['capex cycle', 'industrial cycle'], focusSignals: ['orders', 'utilization', 'inventory', 'capex', 'lead times'], preferredHorizons: ['MEDIUM', 'MEDIUM_LONG', 'LONG'], nominationTarget: 30 },
  { id: 'macro_rates_fx', title: 'Macro Rates & FX Strategist', desk: 'MARKET', strategyFamilies: ['macro transmission'], focusSignals: ['rates', 'curve', 'KRW', 'USD', 'liquidity'], preferredHorizons: ['MEDIUM', 'MEDIUM_LONG', 'LONG'], nominationTarget: 30 },
  { id: 'policy_geopolitics', title: 'Policy & Geopolitics Analyst', desk: 'EVENT', strategyFamilies: ['policy repricing'], focusSignals: ['regulation', 'tariffs', 'subsidies', 'geopolitics', 'supply chain'], preferredHorizons: ['SHORT', 'MEDIUM', 'MEDIUM_LONG', 'LONG'], nominationTarget: 30 },
  { id: 'small_mid_liquidity', title: 'Small/Mid-cap Liquidity Analyst', desk: 'FLOW', strategyFamilies: ['liquidity expansion', 'attention rotation'], focusSignals: ['turnover', 'float rotation', 'volume concentration', 'gap risk'], preferredHorizons: ['ULTRA_SHORT', 'SHORT', 'MEDIUM'], nominationTarget: 50 },
  { id: 'portfolio_risk', title: 'Portfolio Risk Officer', desk: 'RISK', strategyFamilies: ['risk budgeting'], focusSignals: ['concentration', 'correlation', 'drawdown', 'gap risk', 'liquidity'], preferredHorizons: ['ULTRA_SHORT', 'SHORT', 'MEDIUM', 'MEDIUM_LONG', 'LONG'], nominationTarget: 20, vetoDomain: ['portfolio concentration', 'liquidity', 'risk limit'] },
  { id: 'trade_architect', title: 'Trade Architect', desk: 'RISK', strategyFamilies: ['asymmetric trade construction'], focusSignals: ['entry', 'invalidation', 'R:R', 'targets', 'execution cost'], preferredHorizons: ['ULTRA_SHORT', 'SHORT', 'MEDIUM', 'MEDIUM_LONG', 'LONG'], nominationTarget: 30, vetoDomain: ['missing invalidation', 'unacceptable payoff'] },
  { id: 'model_validation', title: 'Model Validation Lead', desk: 'QUANT', strategyFamilies: ['OOS validation', 'robustness'], focusSignals: ['sample size', 'OOS EV', 'Monte Carlo', 'regime stability', 'overfit'], preferredHorizons: ['ULTRA_SHORT', 'SHORT', 'MEDIUM', 'MEDIUM_LONG', 'LONG'], nominationTarget: 20, vetoDomain: ['invalid model evidence'] },
  { id: 'adversarial_red_team', title: 'Director of Adversarial Research', desk: 'RED_TEAM', strategyFamilies: ['falsification'], focusSignals: ['counterevidence', 'crowding', 'data gaps', 'alternative explanation', 'tail risk'], preferredHorizons: ['ULTRA_SHORT', 'SHORT', 'MEDIUM', 'MEDIUM_LONG', 'LONG'], nominationTarget: 20, vetoDomain: ['fatal contradiction', 'fabricated evidence'] },
];

export interface CommitteeNomination {
  memberId: string;
  market: string;
  horizon: TradingHorizon;
  rank: number;
  thesis: string;
  strategyId: string | null;
  score: number;
  evidenceIds: string[];
  signalIds: string[];
  dataGaps: string[];
}

export interface CommitteeCrossReview {
  reviewerId: string;
  market: string;
  horizon: TradingHorizon;
  score: number;
  confidence: number;
  support: string[];
  objections: string[];
  dataGaps: string[];
  hardReject: boolean;
}

export interface HeadCouncilCandidate {
  market: string;
  horizon: TradingHorizon;
  nominationCount: number;
  reviewCount: number;
  rawScore: number;
  dissentPenalty: number;
  dataGapPenalty: number;
  finalScore: number;
  hardRejected: boolean;
  rank: number;
  survived: boolean;
  reasons: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const keyOf = (market: string, horizon: TradingHorizon) => `${market}::${horizon}`;

/**
 * Head Council aggregation is deliberately not a simple majority vote.
 * It rewards independent nomination support, averages cross-review scores,
 * penalizes material dissent/data gaps, and applies hard vetoes before the 70% cut.
 */
export const buildHeadCouncilShortlist = (
  nominations: CommitteeNomination[],
  reviews: CommitteeCrossReview[],
  options: { survivalFraction?: number; minCrossReviews?: number } = {},
): HeadCouncilCandidate[] => {
  const survivalFraction = clamp(options.survivalFraction ?? 0.30, 0.05, 1);
  const minCrossReviews = Math.max(1, Math.trunc(options.minCrossReviews ?? 3));
  const candidateKeys = Array.from(new Set(nominations.map((item) => keyOf(item.market, item.horizon))));

  const candidates = candidateKeys.map((key): HeadCouncilCandidate => {
    const [market, horizonRaw] = key.split('::');
    const horizon = horizonRaw as TradingHorizon;
    const candidateNominations = nominations.filter((item) => item.market === market && item.horizon === horizon);
    const candidateReviews = reviews.filter((item) => item.market === market && item.horizon === horizon);
    const reviewScores = candidateReviews.map((item) => clamp(item.score, 0, 100));
    const nominationScores = candidateNominations.map((item) => clamp(item.score, 0, 100));
    const rawScore = reviewScores.length
      ? mean(reviewScores) * 0.75 + mean(nominationScores) * 0.25
      : mean(nominationScores);

    const strongObjections = candidateReviews.filter((item) => item.score < 40 || item.objections.length >= 2).length;
    const dissentRatio = candidateReviews.length ? strongObjections / candidateReviews.length : 0;
    const dissentPenalty = dissentRatio * 18;
    const uniqueDataGaps = new Set([
      ...candidateNominations.flatMap((item) => item.dataGaps),
      ...candidateReviews.flatMap((item) => item.dataGaps),
    ]);
    const dataGapPenalty = Math.min(18, uniqueDataGaps.size * 2.5);
    const hardRejected = candidateReviews.some((item) => item.hardReject);
    const insufficientReviewPenalty = candidateReviews.length < minCrossReviews ? 15 : 0;
    const independentSupportBonus = Math.min(8, Math.max(0, candidateNominations.length - 1) * 1.5);
    const finalScore = hardRejected
      ? 0
      : clamp(rawScore - dissentPenalty - dataGapPenalty - insufficientReviewPenalty + independentSupportBonus, 0, 100);

    return {
      market,
      horizon,
      nominationCount: candidateNominations.length,
      reviewCount: candidateReviews.length,
      rawScore,
      dissentPenalty,
      dataGapPenalty,
      finalScore,
      hardRejected,
      rank: 0,
      survived: false,
      reasons: [
        `${candidateNominations.length} independent nomination(s); ${candidateReviews.length} cross-review(s).`,
        dissentPenalty > 0 ? `Dissent penalty ${dissentPenalty.toFixed(1)}.` : 'No material dissent penalty.',
        dataGapPenalty > 0 ? `Data-gap penalty ${dataGapPenalty.toFixed(1)}.` : 'No material data-gap penalty.',
        hardRejected ? 'Hard veto triggered before ranking.' : 'No hard veto recorded.',
      ],
    };
  }).sort((a, b) => b.finalScore - a.finalScore || b.nominationCount - a.nominationCount);

  const eligible = candidates.filter((candidate) => !candidate.hardRejected && candidate.reviewCount >= minCrossReviews);
  const survivorCount = eligible.length ? Math.max(1, Math.ceil(eligible.length * survivalFraction)) : 0;
  const survivorKeys = new Set(eligible.slice(0, survivorCount).map((candidate) => keyOf(candidate.market, candidate.horizon)));

  return candidates.map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
    survived: survivorKeys.has(keyOf(candidate.market, candidate.horizon)),
  }));
};

export const validateCommitteeNomination = (nomination: CommitteeNomination) => {
  const persona = INVESTMENT_COMMITTEE_PERSONAS.find((item) => item.id === nomination.memberId);
  const errors: string[] = [];
  if (!persona) errors.push(`Unknown committee member ${nomination.memberId}.`);
  if (!nomination.market.trim()) errors.push('Market is required.');
  if (!Number.isFinite(nomination.score) || nomination.score < 0 || nomination.score > 100) errors.push('Nomination score must be 0..100.');
  if (!nomination.thesis.trim()) errors.push('Nomination thesis is required.');
  if (persona && !persona.preferredHorizons.includes(nomination.horizon)) errors.push(`${persona.id} is not configured for ${nomination.horizon}.`);
  return { valid: errors.length === 0, errors };
};
