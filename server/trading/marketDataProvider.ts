export type MarketDataQuality = 'REALTIME' | 'DELAYED' | 'EOD' | 'UNKNOWN';

export type MarketDataUseCase =
  | 'EXECUTION_INTRADAY'
  | 'RESEARCH_INTRADAY'
  | 'SWING_RESEARCH'
  | 'DISPLAY_ONLY';

export interface MarketDataProvenance {
  provider: string;
  source: string;
  quality: MarketDataQuality;
  observedAt: number | null;
  receivedAt: number;
  delayMinutes: number | null;
  executionEligible: boolean;
  researchOnly: boolean;
  reason: string;
}

export interface MarketDataSuitability {
  allowed: boolean;
  useCase: MarketDataUseCase;
  quality: MarketDataQuality;
  reason: string;
}

export const evaluateMarketDataSuitability = (
  provenance: Pick<MarketDataProvenance, 'quality' | 'executionEligible' | 'provider'>,
  useCase: MarketDataUseCase,
): MarketDataSuitability => {
  const { quality, executionEligible, provider } = provenance;

  if (useCase === 'EXECUTION_INTRADAY') {
    const allowed = quality === 'REALTIME' && executionEligible;
    return {
      allowed,
      useCase,
      quality,
      reason: allowed
        ? `${provider} provides execution-eligible realtime market data.`
        : `${provider} ${quality} data is not permitted to authorize intraday execution.`,
    };
  }

  if (useCase === 'RESEARCH_INTRADAY') {
    const allowed = quality === 'REALTIME' || quality === 'DELAYED';
    return {
      allowed,
      useCase,
      quality,
      reason: allowed
        ? `${provider} ${quality} data may be used for observational intraday research with provenance visible.`
        : `${provider} ${quality} data is too weak for intraday research.`,
    };
  }

  if (useCase === 'SWING_RESEARCH') {
    const allowed = quality !== 'UNKNOWN';
    return {
      allowed,
      useCase,
      quality,
      reason: allowed
        ? `${provider} ${quality} data may support swing/research analysis when timestamps and source are preserved.`
        : `${provider} data quality is unknown, so swing research remains fail-closed.`,
    };
  }

  const allowed = quality !== 'UNKNOWN';
  return {
    allowed,
    useCase,
    quality,
    reason: allowed
      ? `${provider} data may be displayed when its quality and timestamp are shown.`
      : `${provider} data quality is unknown and should not be presented as a current market observation.`,
  };
};

export const delayedResearchProvenance = (
  provider: string,
  source: string,
  observedAt: number | null,
  receivedAt = Date.now(),
  delayMinutes: number | null = null,
): MarketDataProvenance => ({
  provider,
  source,
  quality: 'DELAYED',
  observedAt,
  receivedAt,
  delayMinutes,
  executionEligible: false,
  researchOnly: true,
  reason: `${provider} is a delayed research/display fallback. It never grants execution authority.`,
});
