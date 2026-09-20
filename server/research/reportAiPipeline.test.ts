import assert from 'node:assert/strict';
import test from 'node:test';

import { selectDebateParticipants } from './reportAiPipeline';
import type { AnalystReview } from '../../src/report/contracts';

const review = (analystId: string, stance: AnalystReview['stance'], confidence: number): AnalystReview => ({
  reviewId: `review:${analystId}`,
  reportId: 'r1',
  reportVersion: 1,
  analyst: {
    analystId,
    role: analystId,
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

test('debate participants preserve opposing extremes under the cap', () => {
  const selected = selectDebateParticipants([
    review('bull', 'STRONGLY_POSITIVE', 0.8),
    review('positive', 'POSITIVE', 0.9),
    review('neutral', 'NEUTRAL', 0.5),
    review('bear', 'STRONGLY_NEGATIVE', 0.7),
  ], 3);

  assert.equal(selected.includes('bull'), true);
  assert.equal(selected.includes('bear'), true);
  assert.equal(selected.length, 3);
});
