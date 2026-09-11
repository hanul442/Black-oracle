import { COUNCIL_CONSTITUTION_VERSION } from './councilConstitution';
import type { EvidenceAggregate } from './evidence';
import type { MicrostructureSnapshot } from './microstructure';
import type { ExecutionDecision, MultiTimeframeSnapshot } from './types';

export type CouncilVote = 'APPROVE' | 'CAUTION' | 'REJECT' | 'ABSTAIN';
export type CouncilVerdict = 'APPROVE' | 'CONDITIONAL' | 'REJECT';
export type CouncilRole =
  | 'CHIEF_MARKET_STRATEGIST'
  | 'EVIDENCE_INTELLIGENCE'
  | 'QUANT_MODEL_VALIDATION'
  | 'TRADE_ARCHITECT'
  | 'ADVERSARIAL_RESEARCH';
export type CouncilTeam = 'PRIMARY' | 'RED_TEAM';
export type CouncilRedTeamResult = 'INVALIDATED' | 'SERIOUSLY_CHALLENGED' | 'PARTIALLY_SURVIVED' | 'SURVIVED';

export interface CouncilMemberReview {
  role: CouncilRole;
  team: CouncilTeam;
  vote: CouncilVote;
  confidence: number;
  reasons: string[];
  dataGaps: string[];
}

export interface CouncilSnapshot {
  mode: 'SHADOW';
  constitutionVersion: typeof COUNCIL_CONSTITUTION_VERSION;
  decisionMethod: 'EVIDENCE_GATED';
  executionAuthority: false;
  promotionAuthority: false;
  reviewedAction: ExecutionDecision['action'];
  verdict: CouncilVerdict;
  redTeamResult: CouncilRedTeamResult;
  approveCount: number;
  cautionCount: number;
  rejectCount: number;
  abstainCount: number;
  members: CouncilMemberReview[];
  criticalDissent: string[];
  dataGaps: string[];
  summary: string;
}

export interface CouncilInput {
  market: string;
  decision: ExecutionDecision;
  multiTimeframe: MultiTimeframeSnapshot;
  evidence: EvidenceAggregate;
  microstructure?: MicrostructureSnapshot | null;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const bullishRegime = (regime: string) => regime === 'UPTREND' || regime === 'STRONG_UPTREND';
const bearishRegime = (regime: string) => regime === 'DOWNTREND' || regime === 'STRONG_DOWNTREND';

const marketStrategistReview = (input: CouncilInput): CouncilMemberReview => {
  const mtf = input.multiTimeframe;
  const regime = mtf.frames.oneHour.regime;
  const reasons = [
    `MTF action ${mtf.action}; Oracle trade score ${mtf.oracleTradeScore.toFixed(1)}.`,
    `1H regime ${regime.regime} with ${(regime.confidence * 100).toFixed(0)}% confidence.`,
  ];
  let vote: CouncilVote = 'CAUTION';

  if (input.decision.action === 'ENTER') {
    if (mtf.action === 'BUY' && mtf.oracleTradeScore >= 62 && bullishRegime(regime.regime)) vote = 'APPROVE';
    else if (mtf.action === 'SELL' || bearishRegime(regime.regime)) vote = 'REJECT';
  } else if (input.decision.action === 'EXIT') {
    vote = mtf.action === 'SELL' || bearishRegime(regime.regime) ? 'APPROVE' : 'CAUTION';
  } else if (mtf.action === 'WAIT') {
    vote = 'CAUTION';
  } else {
    vote = 'ABSTAIN';
  }

  return {
    role: 'CHIEF_MARKET_STRATEGIST',
    team: 'PRIMARY',
    vote,
    confidence: clamp01(Math.min(mtf.confidence, regime.confidence)),
    reasons,
    dataGaps: [],
  };
};

const evidenceIntelligenceReview = (input: CouncilInput): CouncilMemberReview => {
  const isEquity = /^KRX-\d{6}$/.test(input.market);
  const evidence = input.evidence;
  if (evidence.activeCount === 0) {
    const required = isEquity && input.decision.action === 'ENTER';
    return {
      role: 'EVIDENCE_INTELLIGENCE',
      team: 'PRIMARY',
      vote: required ? 'REJECT' : 'ABSTAIN',
      confidence: 0,
      reasons: [
        required
          ? 'Equity new-risk policy requires source-backed Evidence.'
          : 'No active external Evidence; crypto technical-first policy permits Evidence abstention.',
      ],
      dataGaps: ['No active source-backed external Evidence is attached to this Council snapshot.'],
    };
  }

  const bullish = evidence.score >= 10 && evidence.confidence >= 0.45;
  const bearish = evidence.score <= -10 && evidence.confidence >= 0.45;
  let vote: CouncilVote = 'CAUTION';
  if (input.decision.action === 'ENTER') vote = bullish ? 'APPROVE' : bearish ? 'REJECT' : 'CAUTION';
  else if (input.decision.action === 'EXIT') vote = bearish ? 'APPROVE' : 'ABSTAIN';
  else vote = evidence.contradictionCount > 0 ? 'CAUTION' : 'ABSTAIN';

  return {
    role: 'EVIDENCE_INTELLIGENCE',
    team: 'PRIMARY',
    vote,
    confidence: clamp01(evidence.confidence),
    reasons: [
      `${evidence.activeCount} active Evidence items; score ${evidence.score.toFixed(1)}; contradictions ${evidence.contradictionCount}.`,
      `${evidence.evidenceIds.length} Evidence IDs preserved for lineage.`,
    ],
    dataGaps: [],
  };
};

const quantValidationReview = (_input: CouncilInput): CouncilMemberReview => ({
  role: 'QUANT_MODEL_VALIDATION',
  team: 'PRIMARY',
  vote: 'ABSTAIN',
  confidence: 0,
  reasons: [
    'Strategy OOS, regime-specific validation, Monte Carlo, parameter robustness, calibration, and sample-size metrics are not attached to the deterministic Council input.',
    'Quant validation therefore abstains rather than inventing strategy reliability.',
  ],
  dataGaps: ['Strategy validation packet is unavailable to deterministic Council v3.'],
});

const tradeArchitectReview = (input: CouncilInput): CouncilMemberReview => {
  if (input.decision.action !== 'ENTER') {
    return {
      role: 'TRADE_ARCHITECT',
      team: 'PRIMARY',
      vote: input.decision.action === 'EXIT' ? 'APPROVE' : 'ABSTAIN',
      confidence: input.decision.action === 'EXIT' ? 0.7 : 0,
      reasons: [input.decision.action === 'EXIT' ? 'Existing-risk exit does not require a new-risk trade map.' : 'No new-risk entry is being proposed.'],
      dataGaps: [],
    };
  }

  const stop = Number(input.decision.stopLossPrice);
  const tp1 = Number(input.decision.takeProfit1Price ?? input.decision.takeProfitPrice);
  const tp2 = Number(input.decision.takeProfit2Price ?? input.decision.takeProfitPrice);
  const expectedLoss = Number(input.decision.expectedLossAtStop);
  const hasStop = Number.isFinite(stop) && stop > 0;
  const hasTarget = (Number.isFinite(tp1) && tp1 > 0) || (Number.isFinite(tp2) && tp2 > 0);
  const hasSizing = Number.isFinite(input.decision.notional) && input.decision.notional > 0;
  const hasLossBudget = Number.isFinite(expectedLoss) && expectedLoss > 0;
  const dataGaps: string[] = [];
  if (!hasStop) dataGaps.push('Observable stop/invalidation price is missing.');
  if (!hasTarget) dataGaps.push('Take-profit reference is missing.');
  if (!hasSizing) dataGaps.push('Requested notional is missing or non-positive.');
  if (!hasLossBudget) dataGaps.push('Expected loss at stop is missing.');

  return {
    role: 'TRADE_ARCHITECT',
    team: 'PRIMARY',
    vote: !hasStop || !hasTarget || !hasSizing ? 'REJECT' : hasLossBudget ? 'APPROVE' : 'CAUTION',
    confidence: !hasStop || !hasTarget ? 0.9 : hasLossBudget ? 0.8 : 0.55,
    reasons: [
      `Trade map stop ${hasStop ? 'present' : 'missing'}; target ${hasTarget ? 'present' : 'missing'}; sizing ${hasSizing ? 'present' : 'missing'}.`,
      hasLossBudget ? 'Expected loss at stop is recorded.' : 'Expected loss at stop is not available; payoff quality cannot be fully evaluated.',
    ],
    dataGaps,
  };
};

const adversarialResearchReview = (input: CouncilInput): CouncilMemberReview & { redTeamResult: CouncilRedTeamResult } => {
  const contradictions = input.evidence.contradictionCount;
  const micro = input.microstructure;
  const mtf = input.multiTimeframe;
  const regime = mtf.frames.oneHour.regime.regime;
  const reasons: string[] = [];
  const dataGaps: string[] = [];
  let pressure = 0;

  if (contradictions > 0) {
    pressure += contradictions >= 2 ? 3 : 2;
    reasons.push(`${contradictions} source-backed Evidence contradiction(s) remain active.`);
  }
  if (mtf.confidence < 0.62) {
    pressure += 1;
    reasons.push(`MTF confidence ${(mtf.confidence * 100).toFixed(0)}% is below the usual entry threshold.`);
  }
  if (input.decision.action === 'ENTER' && bearishRegime(regime)) {
    pressure += 2;
    reasons.push(`1H regime ${regime} conflicts with a proposed new long risk entry.`);
  }
  if (input.decision.action === 'ENTER' && micro?.available && micro.direction === 'BEARISH' && micro.confidence >= 0.55) {
    pressure += 2;
    reasons.push('Observed microstructure is materially bearish against the proposed entry.');
  }
  if (input.decision.action === 'ENTER' && !micro?.available) {
    dataGaps.push('Microstructure is unavailable; Red Team cannot test short-horizon execution pressure.');
  }
  if (!reasons.length) reasons.push('No material contradiction or structural failure trigger was found in the attached deterministic snapshot.');

  const redTeamResult: CouncilRedTeamResult = pressure >= 5
    ? 'INVALIDATED'
    : pressure >= 3
      ? 'SERIOUSLY_CHALLENGED'
      : pressure >= 1
        ? 'PARTIALLY_SURVIVED'
        : 'SURVIVED';

  return {
    role: 'ADVERSARIAL_RESEARCH',
    team: 'RED_TEAM',
    vote: redTeamResult === 'INVALIDATED' || redTeamResult === 'SERIOUSLY_CHALLENGED'
      ? 'REJECT'
      : redTeamResult === 'PARTIALLY_SURVIVED'
        ? 'CAUTION'
        : 'APPROVE',
    confidence: clamp01(0.5 + Math.min(pressure, 4) * 0.1),
    reasons,
    dataGaps,
    redTeamResult,
  };
};

export const buildShadowCouncil = (input: CouncilInput): CouncilSnapshot => {
  const redTeam = adversarialResearchReview(input);
  const members: CouncilMemberReview[] = [
    marketStrategistReview(input),
    evidenceIntelligenceReview(input),
    quantValidationReview(input),
    tradeArchitectReview(input),
    redTeam,
  ];
  const approveCount = members.filter((member) => member.vote === 'APPROVE').length;
  const cautionCount = members.filter((member) => member.vote === 'CAUTION').length;
  const rejectCount = members.filter((member) => member.vote === 'REJECT').length;
  const abstainCount = members.filter((member) => member.vote === 'ABSTAIN').length;
  const market = members.find((member) => member.role === 'CHIEF_MARKET_STRATEGIST');
  const evidence = members.find((member) => member.role === 'EVIDENCE_INTELLIGENCE');
  const quant = members.find((member) => member.role === 'QUANT_MODEL_VALIDATION');
  const trade = members.find((member) => member.role === 'TRADE_ARCHITECT');
  const hardReject = input.decision.action === 'ENTER' && (
    market?.vote === 'REJECT'
    || evidence?.vote === 'REJECT'
    || trade?.vote === 'REJECT'
    || redTeam.redTeamResult === 'INVALIDATED'
  );
  const materialChallenge = input.decision.action === 'ENTER' && (
    redTeam.redTeamResult === 'SERIOUSLY_CHALLENGED'
    || market?.vote === 'CAUTION'
    || evidence?.vote === 'CAUTION'
    || trade?.vote === 'CAUTION'
    || quant?.vote === 'ABSTAIN'
  );
  const primaryReady = market?.vote === 'APPROVE'
    && trade?.vote === 'APPROVE'
    && evidence?.vote !== 'REJECT'
    && quant?.vote !== 'REJECT';

  const verdict: CouncilVerdict = hardReject
    ? 'REJECT'
    : input.decision.action === 'ENTER' && primaryReady && !materialChallenge && redTeam.redTeamResult === 'SURVIVED'
      ? 'APPROVE'
      : 'CONDITIONAL';

  const dataGaps = Array.from(new Set(members.flatMap((member) => member.dataGaps)));
  const criticalDissent = [
    ...(redTeam.redTeamResult === 'INVALIDATED' || redTeam.redTeamResult === 'SERIOUSLY_CHALLENGED' ? redTeam.reasons : []),
    ...members.filter((member) => member.team === 'PRIMARY' && member.vote === 'REJECT').flatMap((member) => member.reasons),
  ];

  return {
    mode: 'SHADOW',
    constitutionVersion: COUNCIL_CONSTITUTION_VERSION,
    decisionMethod: 'EVIDENCE_GATED',
    executionAuthority: false,
    promotionAuthority: false,
    reviewedAction: input.decision.action,
    verdict,
    redTeamResult: redTeam.redTeamResult,
    approveCount,
    cautionCount,
    rejectCount,
    abstainCount,
    members,
    criticalDissent,
    dataGaps,
    summary: `Council v3 ${verdict}; Red Team ${redTeam.redTeamResult}. Counts are observability only, not a majority-vote decision rule. No execution authority.`,
  };
};
