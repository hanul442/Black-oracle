import assert from 'node:assert/strict';
import test from 'node:test';

import { decideDebatePolicy, shouldPublishNewReportVersion } from './reportPolicy';
import type { AnalystReview } from '../../src/report/contracts';

const review = (stance: AnalystReview['stance'], confidence: number): AnalystReview => ({
  reviewId: `review-${stance}-${confidence}`,
  reportId: 'r1',
  reportVersion: 1,
  analyst: {
    analystId: stance,
    role: stance,
    domain: 'test',
    methodVersion: '1',
    promptVersion: '1',
  },
  asOf: 1,
  knowledgeCutoff: 1,
  stance,
  confidence,
  assessment: '',
  facts: [],
  inferences: [],
  assumptions: [],
  supportingEvidence: [],
  counterevidence: [],
  dataGaps: [],
  strongestCounterargument: null,
  invalidationConditions: [],
});

test('debate is skipped when independent analysts converge', () => {
  const decision = decideDebatePolicy({
    reportType: 'SECURITY',
    reviews: [review('POSITIVE', 0.7), review('POSITIVE', 0.72)],
    materialEvent: false,
    materialGradeChange: false,
    highUncertainty: false,
  });
  assert.equal(decision.shouldDebate, false);
  assert.equal(decision.shouldRunRedTeam, false);
});

test('debate activates for material stance disagreement', () => {
  const decision = decideDebatePolicy({
    reportType: 'SECURITY',
    reviews: [review('STRONGLY_POSITIVE', 0.8), review('NEGATIVE', 0.75)],
    materialEvent: false,
    materialGradeChange: false,
    highUncertainty: false,
  });
  assert.equal(decision.shouldDebate, true);
  assert.equal(decision.shouldRunRedTeam, true);
});

test('report version publishes only for material change', () => {
  assert.equal(shouldPublishNewReportVersion({
    hasNewEvidence: true,
    materialEvidenceChange: false,
    gradeChanged: false,
    forecastChanged: false,
    leadConclusionChanged: false,
    correctionRequired: false,
  }), false);

  assert.equal(shouldPublishNewReportVersion({
    hasNewEvidence: true,
    materialEvidenceChange: true,
    gradeChanged: false,
    forecastChanged: false,
    leadConclusionChanged: false,
    correctionRequired: false,
  }), true);
});
