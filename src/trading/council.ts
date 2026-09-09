import type { EvidenceAggregate } from './evidence';
import type { MicrostructureSnapshot } from './microstructure';
import type { ExecutionDecision, MultiTimeframeSnapshot } from './types';

export type CouncilVote = 'APPROVE' | 'CAUTION' | 'REJECT' | 'ABSTAIN';
export type CouncilVerdict = 'APPROVE' | 'CONDITIONAL' | 'REJECT';

export interface CouncilMemberReview {
  role: 'TECHNICAL' | 'REGIME' | 'EVIDENCE' | 'RISK' | 'SKEPTIC';
  vote: CouncilVote;
  confidence: number;
  reasons: string[];
}

export interface CouncilSnapshot {
  mode: 'SHADOW';
  executionAuthority: false;
  promotionAuthority: false;
  reviewedAction: ExecutionDecision['action'];
  verdict: CouncilVerdict;
  approveCount: number;
  cautionCount: number;
  rejectCount: number;
  abstainCount: number;
  members: CouncilMemberReview[];
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

const technicalReview = (input: CouncilInput): CouncilMemberReview => {
  const mtf = input.multiTimeframe;
  const score = mtf.oracleTradeScore;
  const action = mtf.action;
  let vote: CouncilVote = 'CAUTION';
  if (input.decision.action === 'ENTER') vote = action === 'BUY' && score >= 62 ? 'APPROVE' : 'REJECT';
  else if (input.decision.action === 'EXIT') vote = action === 'SELL' || score < 45 ? 'APPROVE' : 'CAUTION';
  else if (action === 'WAIT') vote = 'CAUTION';
  else vote = 'ABSTAIN';
  return {
    role: 'TECHNICAL',
    vote,
    confidence: clamp01(mtf.confidence),
    reasons: [`MTF action ${action}; Oracle trade score ${score.toFixed(1)}.`],
  };
};

const regimeReview = (input: CouncilInput): CouncilMemberReview => {
  const regime = input.multiTimeframe.frames.oneHour.regime;
  const bullish = regime.regime === 'UPTREND' || regime.regime === 'STRONG_UPTREND';
  const bearish = regime.regime === 'DOWNTREND' || regime.regime === 'STRONG_DOWNTREND';
  let vote: CouncilVote = 'CAUTION';
  if (input.decision.action === 'ENTER') vote = bullish ? 'APPROVE' : bearish ? 'REJECT' : 'CAUTION';
  else if (input.decision.action === 'EXIT') vote = bearish ? 'APPROVE' : 'CAUTION';
  else vote = regime.regime === 'RANGE' ? 'CAUTION' : 'ABSTAIN';
  return {
    role: 'REGIME',
    vote,
    confidence: clamp01(regime.confidence),
    reasons: [`1H regime ${regime.regime} with ${(regime.confidence * 100).toFixed(0)}% confidence.`],
  };
};

const evidenceReview = (input: CouncilInput): CouncilMemberReview => {
  const isEquity = /^KRX-\d{6}$/.test(input.market);
  const evidence = input.evidence;
  if (evidence.activeCount === 0) {
    return {
      role: 'EVIDENCE',
      vote: isEquity && input.decision.action === 'ENTER' ? 'REJECT' : 'ABSTAIN',
      confidence: 0,
      reasons: [isEquity ? 'Equity new-risk policy requires source-backed Evidence.' : 'No active external Evidence; crypto technical-first policy permits abstention.'],
    };
  }
  const bullish = evidence.score >= 10 && evidence.confidence >= 0.45;
  const bearish = evidence.score <= -10 && evidence.confidence >= 0.45;
  let vote: CouncilVote = 'CAUTION';
  if (input.decision.action === 'ENTER') vote = bullish ? 'APPROVE' : bearish ? 'REJECT' : 'CAUTION';
  else if (input.decision.action === 'EXIT') vote = bearish ? 'APPROVE' : 'ABSTAIN';
  else vote = evidence.contradictionCount > 0 ? 'CAUTION' : 'ABSTAIN';
  return {
    role: 'EVIDENCE',
    vote,
    confidence: clamp01(evidence.confidence),
    reasons: [`${evidence.activeCount} active Evidence items; score ${evidence.score.toFixed(1)}; contradictions ${evidence.contradictionCount}.`],
  };
};

const riskReview = (input: CouncilInput): CouncilMemberReview => {
  const status = input.decision.riskDisposition;
  const vote: CouncilVote = status === 'APPROVE' ? 'APPROVE' : status === 'REJECT' ? 'REJECT' : 'CAUTION';
  return {
    role: 'RISK',
    vote,
    confidence: status === 'APPROVE' || status === 'REJECT' ? 0.95 : 0.55,
    reasons: input.decision.riskReasons.length ? input.decision.riskReasons.slice(0, 3) : [`Risk disposition ${status}.`],
  };
};

const skepticReview = (input: CouncilInput): CouncilMemberReview => {
  const contradictions = input.evidence.contradictionCount;
  const micro = input.microstructure;
  const mtf = input.multiTimeframe;
  const reasons: string[] = [];
  let pressure = 0;
  if (contradictions > 0) {
    pressure += 2;
    reasons.push(`${contradictions} Evidence contradiction(s) remain active.`);
  }
  if (mtf.confidence < 0.62) {
    pressure += 1;
    reasons.push(`MTF confidence ${(mtf.confidence * 100).toFixed(0)}% is below the usual entry threshold.`);
  }
  if (input.decision.action === 'ENTER' && micro?.available && micro.direction === 'BEARISH' && micro.confidence >= 0.55) {
    pressure += 2;
    reasons.push('Microstructure is materially bearish against the proposed entry.');
  }
  if (!reasons.length) reasons.push('No material contradiction or timing objection detected.');
  return {
    role: 'SKEPTIC',
    vote: pressure >= 3 ? 'REJECT' : pressure >= 1 ? 'CAUTION' : 'APPROVE',
    confidence: clamp01(0.45 + pressure * 0.12),
    reasons,
  };
};

export const buildShadowCouncil = (input: CouncilInput): CouncilSnapshot => {
  const members = [
    technicalReview(input),
    regimeReview(input),
    evidenceReview(input),
    riskReview(input),
    skepticReview(input),
  ];
  const approveCount = members.filter((member) => member.vote === 'APPROVE').length;
  const cautionCount = members.filter((member) => member.vote === 'CAUTION').length;
  const rejectCount = members.filter((member) => member.vote === 'REJECT').length;
  const abstainCount = members.filter((member) => member.vote === 'ABSTAIN').length;
  const riskRejected = members.some((member) => member.role === 'RISK' && member.vote === 'REJECT');
  const verdict: CouncilVerdict = riskRejected || rejectCount >= 2
    ? 'REJECT'
    : approveCount >= 3 && rejectCount === 0
      ? 'APPROVE'
      : 'CONDITIONAL';
  return {
    mode: 'SHADOW',
    executionAuthority: false,
    promotionAuthority: false,
    reviewedAction: input.decision.action,
    verdict,
    approveCount,
    cautionCount,
    rejectCount,
    abstainCount,
    members,
    summary: `Shadow Council ${verdict}: ${approveCount} approve, ${cautionCount} caution, ${rejectCount} reject, ${abstainCount} abstain. No execution authority.`,
  };
};
