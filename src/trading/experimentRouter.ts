import type { ExperimentResult } from './experiment';
import type { MonteCarloVerdict } from './monteCarlo';
import type { ReliabilityVerdict } from './championChallenger';

export type ExperimentRouterDisposition = 'ELIGIBLE' | 'WATCH' | 'BLOCKED' | 'NO_TRADE';

export interface ExperimentRouterEvidenceInput {
  candidateId: string;
  experimentResult: ExperimentResult;
  monteCarloVerdict: MonteCarloVerdict;
  reliabilityVerdict: ReliabilityVerdict;
  currentRegime: string;
  supportedRegimes: string[];
}

export interface ExperimentRouterEvidence {
  candidateId: string;
  disposition: ExperimentRouterDisposition;
  score: number;
  currentRegime: string;
  regimeSupported: boolean;
  experimentStatus: ExperimentResult['status'];
  monteCarloVerdict: MonteCarloVerdict;
  reliabilityVerdict: ReliabilityVerdict;
  passedMetricRatio: number | null;
  reasons: string[];
  executionAuthority: false;
}

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const metricPassRatio = (result: ExperimentResult) => {
  const evaluated = result.metrics.filter((metric) => metric.passed !== null);
  if (!evaluated.length) return null;
  return evaluated.filter((metric) => metric.passed === true).length / evaluated.length;
};

export const buildExperimentRouterEvidence = (input: ExperimentRouterEvidenceInput): ExperimentRouterEvidence => {
  const candidateId = input.candidateId.trim();
  if (!candidateId) throw new Error('Router evidence candidateId is required.');

  const currentRegime = input.currentRegime.trim().toUpperCase();
  const supported = new Set(input.supportedRegimes.map((item) => item.trim().toUpperCase()).filter(Boolean));
  const regimeSupported = supported.size === 0 || supported.has(currentRegime);
  const passedMetricRatio = metricPassRatio(input.experimentResult);
  const reasons: string[] = [];

  let score = 0;
  if (input.experimentResult.status === 'PASSED') score += 40;
  else reasons.push(`Experiment status ${input.experimentResult.status} blocks candidate eligibility.`);

  if (passedMetricRatio !== null) score += passedMetricRatio * 20;

  if (input.monteCarloVerdict === 'PASS') score += 25;
  else if (input.monteCarloVerdict === 'WATCH') {
    score += 12;
    reasons.push('Monte Carlo verdict WATCH requires caution.');
  } else if (input.monteCarloVerdict === 'INSUFFICIENT_DATA') {
    reasons.push('Monte Carlo validation has insufficient data.');
  } else {
    reasons.push('Monte Carlo verdict REJECT blocks candidate eligibility.');
  }

  if (input.reliabilityVerdict === 'PASS') score += 10;
  else if (input.reliabilityVerdict === 'EXTEND') {
    score += 5;
    reasons.push('Reliability soak requires extension.');
  } else {
    reasons.push('Reliability verdict BLOCK blocks candidate eligibility.');
  }

  if (regimeSupported) score += 5;
  else reasons.push(`Current regime ${currentRegime || 'UNKNOWN'} is outside the candidate's supported regime set.`);

  let disposition: ExperimentRouterDisposition;
  if (!regimeSupported) {
    disposition = 'NO_TRADE';
  } else if (
    input.experimentResult.status !== 'PASSED'
    || input.monteCarloVerdict === 'REJECT'
    || input.reliabilityVerdict === 'BLOCK'
  ) {
    disposition = 'BLOCKED';
  } else if (
    input.monteCarloVerdict !== 'PASS'
    || input.reliabilityVerdict !== 'PASS'
  ) {
    disposition = 'WATCH';
  } else {
    disposition = 'ELIGIBLE';
  }

  return Object.freeze({
    candidateId,
    disposition,
    score: clampScore(score),
    currentRegime,
    regimeSupported,
    experimentStatus: input.experimentResult.status,
    monteCarloVerdict: input.monteCarloVerdict,
    reliabilityVerdict: input.reliabilityVerdict,
    passedMetricRatio,
    reasons: Object.freeze(reasons) as string[],
    executionAuthority: false,
  });
};
