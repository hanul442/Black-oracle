export type CouncilMember = {
  role: string;
  vote: string;
  confidence: number;
  reasons: string[];
  advisoryOnly?: boolean;
  executionAuthority?: boolean;
};

export type CouncilSnapshot = {
  verdict: string;
  reviewedAction?: string;
  approveCount?: number;
  cautionCount?: number;
  rejectCount?: number;
  abstainCount?: number;
  members?: CouncilMember[];
  summary?: string;
  aiReview?: AiCouncilReview | null;
};

export type AiCouncilReview = {
  market?: string;
  stance?: string;
  confidence?: number;
  rationale?: string;
  concerns?: string[];
  whatWouldChangeMind?: string;
  model?: string;
  escalationReason?: string;
  advisoryOnly?: boolean;
  executionAuthority?: boolean;
};

export type TradeMap = {
  status?: string;
  direction?: string;
  entryPrice?: number | null;
  structuralInvalidationPrice?: number | null;
  stopLossPrice?: number | null;
  takeProfit1Price?: number | null;
  takeProfit2Price?: number | null;
  takeProfit1Fraction?: number | null;
  takeProfit2Fraction?: number | null;
  riskReward1?: number | null;
  riskReward2?: number | null;
  expectedRiskPct?: number | null;
  reasons?: string[];
};

export type DecisionTapeItem = {
  timestamp: number;
  market: string;
  decision: string;
  assetClass?: string;
  regime?: string | null;
  regimeConfidence?: number | null;
  oracleTradeScore: number | null;
  confidence?: number | null;
  strategyDisposition?: string | null;
  router?: { route?: string; reasons?: string[] } | null;
  council?: CouncilSnapshot | null;
  riskDisposition?: string | null;
  eventScore?: number | null;
  evidenceActiveCount?: number;
  evidenceContradictionCount?: number;
  evidenceIds?: string[];
  technicalEvidence?: null | {
    rawSignalCount?: number;
    independentFamilyCount?: number;
    correlatedSignalPenalty?: number;
    directionalScore?: number;
    confidence?: number;
    bullishFamilies?: number;
    bearishFamilies?: number;
    neutralFamilies?: number;
  };
  structure?: null | {
    bias?: string;
    confidence?: number;
    eventType?: string | null;
    eventDirection?: string | null;
    location?: string;
    percentile?: number;
    liquiditySweep?: string | null;
  };
  cycle?: null | {
    entryTiming?: string;
    alignment?: string;
    confidence?: number;
    reasons?: string[];
    frames?: Record<string, unknown>;
  };
  microstructure?: null | {
    available?: boolean;
    sampleTrades?: number;
    sampleCoverageMs?: number | null;
    takerImbalance?: number | null;
    orderbookImbalanceTop5?: number | null;
    orderbookImbalanceTop15?: number | null;
    orderbookImbalanceTop30?: number | null;
    pressureScore?: number | null;
    direction?: string;
    confidence?: number;
    pointOfControl?: number | null;
    valueAreaLow?: number | null;
    valueAreaHigh?: number | null;
    profileLocation?: string;
  };
  challenger?: Record<string, unknown> | null;
  tradeMap?: TradeMap | null;
  primaryReason?: string | null;
  reasons?: string[];
  riskReasons?: string[];
  forecast?: null | {
    available: boolean;
    direction: string;
    probabilityBullish: number | null;
    probabilityBearish: number | null;
    confidence: number;
    uncertainty: number;
    reasons?: string[];
  };
  aiCouncilReview?: AiCouncilReview | null;
};

export type ClosedTrade = {
  id: string;
  market: string;
  openedAt: number;
  closedAt: number;
  entryPrice: number;
  exitPrice: number;
  quantity?: number;
  grossPnl?: number;
  netPnl: number;
  returnPct: number;
  fees: number;
  exitReason: string;
  strategyVersion: string;
  entryOracleTradeScore: number;
  exitOracleTradeScore: number;
  entryAudit?: Record<string, unknown> | null;
};

export type OpenPosition = {
  market: string;
  quantity: number;
  initialQuantity?: number;
  averageCost: number;
  entryPrice: number;
  openedAt: number;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  takeProfit1Price?: number | null;
  takeProfit2Price?: number | null;
  takeProfit1Taken?: boolean;
  takeProfit1Fraction?: number | null;
};

export type OperationalEvidence = {
  id: string;
  packet_outbox_id?: string | null;
  event_id?: string | null;
  market?: string | null;
  title?: string | null;
  direction?: string | null;
  strength?: number | null;
  reliability?: number | null;
  source_type?: string | null;
  source?: string | null;
  observed_at?: string | null;
  expires_at?: string | null;
  rationale?: string | null;
  materiality?: string | null;
  impact_confidence?: number | null;
  evidence_grade?: string | null;
  evidence_score?: number | null;
  citations?: unknown;
  eligible_for_new_risk?: boolean | null;
  analysis_model?: string | null;
  analysis_version?: string | null;
};

export type OperationsPayload = {
  success?: boolean;
  available?: boolean;
  status?: 'OK' | 'DEGRADED' | 'WAITING' | 'ERROR' | 'UNAVAILABLE';
  mode?: 'PAPER';
  strategyVersion?: string | null;
  loop?: {
    cycleCount: number;
    intervalMs: number;
    maxMarkets: number;
    maxOpenPositions: number;
    ageMs: number | null;
    stale: boolean;
    lastCycle: null | {
      startedAt: number;
      finishedAt: number;
      durationMs: number;
      scanned: number;
      entered: number;
      exited: number;
      held: number;
      noTrade?: number;
      errors: Array<{ market: string; error: string }>;
    };
  };
  portfolio?: {
    initialEquity: number;
    equity: number;
    cash: number;
    realizedPnl: number;
    feesPaid: number;
    dailyPnlPct: number;
    currentDrawdownPct: number;
    openPositions: OpenPosition[];
  };
  performance?: {
    trades: number;
    wins: number;
    losses: number;
    breakeven: number;
    winRate: number;
    grossProfit: number;
    grossLoss: number;
    netPnl: number;
    expectancy: number;
    avgWin: number;
    avgLoss: number;
    payoffRatio: number | null;
    profitFactor: number | null;
    avgReturnPct: number;
    totalReturnPct: number;
    maxDrawdownPct: number;
    currentDrawdownPct: number;
  };
  ingestion?: {
    markedMarkets: number;
    evidenceTotal: number;
    evidenceActive: number;
    evidenceExpired: number;
    externalEvidenceActive?: number;
    evidenceRequests?: number;
    narsInboxRecent?: number;
    scannedMarketsLastCycle: number;
    lastCycleErrors: number;
  };
  council?: {
    mode?: string;
    executionAuthority?: boolean;
    latest?: CouncilSnapshot | null;
    deterministicLatest?: CouncilSnapshot | null;
    stats?: Record<string, number>;
    ai?: { current?: AiCouncilReview | null; historicalLatest?: AiCouncilReview | null };
  };
  evidenceFlow?: OperationalEvidence[];
  equityCurve?: Array<{ timestamp: number; equity: number }>;
  decisionTape?: DecisionTapeItem[];
  recentTrades?: ClosedTrade[];
};

export type Lifecycle = 'REJECT' | 'INCUBATOR' | 'CHALLENGER' | 'CHAMPION_CANDIDATE';

export type FactoryTop = {
  genome: { id: string; generation?: number; indicators: string[] };
  hypothesis?: { thesis?: string; parentIds?: string[]; origin?: string };
  metrics: {
    totalSamples: number;
    oosSamples: number;
    oosExpectancy: number;
    sharpe: number;
    sortino: number;
    maxDrawdownPct: number;
    monteCarloSurvivalRate: number;
    regimeStability: number;
    parameterRobustness: number;
  };
  evaluation: {
    score: number;
    lifecycle?: Lifecycle;
    hardGatePassed: boolean;
    hardGateReasons: string[];
  };
  validation?: {
    blind?: { samples: number; expectancy: number; sharpe: number; maxDrawdownPct: number; winRate: number };
    walkForward?: { eligibleFolds: number; positiveFoldRate: number; worstExpectancy: number };
    costStress?: { survivalRate: number; worstExpectancy: number };
    regimeStress?: { eligibleRegimes: number; positiveRegimeRate: number; worstExpectancy: number };
    monteCarloSurvivalRate?: number;
    parameterRobustness?: number;
  };
};

export type FactoryPayload = {
  success?: boolean;
  available?: boolean;
  latestRun?: null | {
    id: string;
    market: string;
    timeframe_minutes: number;
    candidate_count: number;
    top_results: FactoryTop[];
    lifecycle_counts?: Partial<Record<Lifecycle, number>>;
    status_counts?: Record<string, number>;
  };
};

export type StrategyCard = {
  id: string;
  name: string;
  lifecycle: string;
  thesis: string;
  score: number | null;
  sharpe: number | null;
  mdd: number | null;
  survival: number | null;
  robustness: number | null;
  winRate: number | null;
  samples: number;
  profile: number[];
  hardGatePassed: boolean;
  reasons: string[];
};

export type LedgerEvent = {
  id: string;
  eventKey: string;
  occurredAt: number;
  recordedAt?: number;
  runtimeId?: string | null;
  eventType: string;
  eventName: string;
  market: string | null;
  strategyId: string | null;
  strategyVersion: string | null;
  action: string | null;
  summary: string;
  reason: string | null;
  severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  authority: string;
  executionAuthority: boolean;
  source: string;
  trace?: Record<string, unknown>;
  links?: Record<string, unknown>;
  schemaVersion?: number;
};

export type EventsPayload = {
  success?: boolean;
  canonical?: boolean;
  appendOnly?: boolean;
  coverage?: string;
  source?: string;
  events?: LedgerEvent[];
};

export type PriceCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type PriceChartPayload = {
  success?: boolean;
  available?: boolean;
  market?: string;
  unit?: number;
  candles?: PriceCandle[];
  error?: string;
};

export type Tab = 'home' | 'market' | 'strategies' | 'portfolio' | 'more';
export type DetailRoute = 'strategy' | 'position' | 'analysis' | 'evidence' | 'evidence-item' | 'council' | 'trade' | 'log' | 'event' | null;

export const number = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
export const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
export const money = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `₩${number.format(value)}`;
export const pct = (value: number | null | undefined, signed = false) => {
  if (value == null || !Number.isFinite(value)) return '—';
  const points = value * 100;
  return `${signed && points > 0 ? '+' : ''}${decimal.format(points)}%`;
};
export const scoreText = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : decimal.format(value);
export const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

export const timeAgo = (timestamp: number | null | undefined) => {
  if (!timestamp) return '—';
  const delta = Math.max(0, Date.now() - timestamp);
  if (delta < 60_000) return `${Math.max(1, Math.round(delta / 1000))}초 전`;
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)}분 전`;
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)}시간 전`;
  return `${Math.round(delta / 86_400_000)}일 전`;
};

export const dateTime = (timestamp: number | string | null | undefined) => {
  if (!timestamp) return '—';
  const value = typeof timestamp === 'number' ? timestamp : Date.parse(timestamp);
  if (!Number.isFinite(value)) return '—';
  return new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(value);
};

export const actionKo = (value: string | null | undefined) => ({ ENTER: '진입', EXIT: '청산', HOLD: '보유', NO_TRADE: '거래 안 함', BUY: '매수', SELL: '매도', APPROVE: '찬성', CAUTION: '주의', REJECT: '반대', ABSTAIN: '보류', CONDITIONAL: '조건부' }[String(value ?? '').toUpperCase()] ?? String(value ?? '—'));
export const roleKo = (value: string | null | undefined) => ({ TECHNICAL: '기술 분석', REGIME: '시장 국면', EVIDENCE: '근거 분석', RISK: '리스크', SKEPTIC: '반대 검토', AI_SHADOW_ADJUDICATOR: 'AI 심사관' }[String(value ?? '').toUpperCase()] ?? String(value ?? 'Council'));
export const regimeKo = (value: string | null | undefined) => ({ STRONG_UPTREND: '강한 상승 추세', UPTREND: '상승 추세', RANGE: '횡보', DOWNTREND: '하락 추세', STRONG_DOWNTREND: '강한 하락 추세' }[String(value ?? '').toUpperCase()] ?? String(value ?? '미확인'));
export const eventTypeKo = (value: string | null | undefined) => ({ SYSTEM: '시스템', EVIDENCE: '근거', STRATEGY: '전략', COUNCIL: 'Council', DECISION: '판단', RISK: '리스크', ORDER: '주문', TRADE: '거래', OUTCOME: '결과', EXPERIMENT: '실험', AI: 'AI' }[String(value ?? '').toUpperCase()] ?? String(value ?? '로그'));

export const scoreHex = (value: number | null | undefined, max = 100) => {
  if (value == null || !Number.isFinite(value)) return '#98a2ad';
  const normalized = max === 1 ? value * 100 : value;
  if (normalized >= 70) return '#0aa77d';
  if (normalized >= 55) return '#d49535';
  return '#dc5a66';
};

export const strategyName = (item: FactoryTop, index: number) => {
  const haystack = `${item.hypothesis?.thesis ?? ''} ${item.genome.indicators.join(' ')}`.toLowerCase();
  if (haystack.includes('momentum') || haystack.includes('ema') || haystack.includes('trend')) return 'Momentum Pro';
  if (haystack.includes('mean') || haystack.includes('reversion') || haystack.includes('rsi')) return 'Mean Reversion';
  if (haystack.includes('volatility') || haystack.includes('atr') || haystack.includes('breakout')) return 'Volatility Breakout';
  if (haystack.includes('macro')) return 'Macro Trend';
  if (haystack.includes('event') || haystack.includes('news')) return 'Event Driven';
  return `Oracle Strategy ${index + 1}`;
};

export const eventTags = (event: LedgerEvent) => [event.eventType, event.market, event.action, event.strategyId, event.severity !== 'INFO' ? event.severity : null].filter(Boolean) as string[];

export const reasonKo = (reason: string | null | undefined) => {
  const text = String(reason ?? '').trim();
  if (!text) return '별도 사유가 기록되지 않았습니다.';
  if (text.includes('Protective stop-loss was reached')) return '보호 손절 가격에 도달해 포지션을 청산했습니다.';
  if (text.includes('Dynamic second take-profit target was reached')) return '2차 익절 목표에 도달해 남은 포지션을 청산했습니다.';
  if (text.includes('Dynamic first take-profit target was reached')) return '1차 익절 목표에 도달해 일부 수익을 실현하고 잔여 물량은 2차 목표까지 유지합니다.';
  if (text.includes('Existing position remains inside its dynamic protection plan')) return '현재 가격이 동적 손절·익절 범위 안에 있어 포지션을 유지합니다.';
  if (text.includes('Liquidity gate rejected')) return '유동성 조건을 충족하지 못해 거래 후보에서 제외했습니다.';
  if (text.includes('requires BUY consensus')) return '신규 진입에 필요한 다중 시간대 매수 합의와 최소 신뢰도를 충족하지 못했습니다.';
  if (text.includes('risk gate rejected') || text.includes('Risk Gate')) return '결정론적 리스크 게이트가 신규 위험을 허용하지 않았습니다.';
  if (text.includes('No material contradiction')) return '현재 확인된 중대한 반대 근거나 타이밍 문제는 없습니다.';
  if (text.includes('No active external Evidence')) return '활성 외부 근거가 없어 근거 분석은 표결을 보류했습니다.';
  if (text.includes('Equity new-risk policy requires')) return '주식 신규 진입에는 출처가 확인된 근거가 필요합니다.';
  return text;
};
