import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPublishedReportVersion } from './reportPublication';
import type { ReportResearchBundle } from './reportAiPipeline';

const bundle: ReportResearchBundle = {
  reportId: 'security:005930',
  reportVersion: 2,
  reportType: 'SECURITY',
  subject: {
    subjectId: 'security:005930',
    subjectType: 'SECURITY',
    canonicalSymbol: '005930',
    displayName: 'Samsung Electronics',
  },
  asOf: 1000,
  knowledgeCutoff: 900,
  analystReviews: [],
  debate: null,
  synthesis: {
    synthesisId: 's1',
    reportId: 'security:005930',
    reportVersion: 2,
    leadAnalyst: {
      analystId: 'security_lead',
      role: 'Security Lead Analyst',
      domain: 'security',
      methodVersion: '1.0',
      promptVersion: '1.0',
    },
    asOf: 1000,
    grade: 'A+',
    confidence: 0.7,
    oneLineAssessment: 'Attractiveness improved after price correction.',
    executiveSummary: 'Summary',
    thesis: 'Thesis',
    supportingPoints: [],
    opposingPoints: [],
    preservedDissent: [],
    majorRisks: [],
    invalidationConditions: [],
    limitations: [],
  },
  forecast: null,
  actionGuide: {
    horizon: '3M',
    attractivenessSummary: 'Strong but not risk-free.',
    approach: 'STAGED_APPROACH',
    approachRationale: [],
    supportResistanceSummary: null,
    risks: [],
    invalidationConditions: [],
  },
  trace: {
    selectedAnalystIds: [],
    debateParticipantIds: [],
    redTeamUsed: false,
    evidenceIds: ['e1'],
    fastModel: 'test',
    deepModel: 'test',
  },
};

test('publication builder keeps discovery fields and immutable trace pointers', () => {
  const report = buildPublishedReportVersion({ bundle, publishedAt: 2000 });

  assert.equal(report.status, 'PUBLISHED');
  assert.equal(report.grade, 'A+');
  assert.equal(report.oneLineAssessment, bundle.synthesis.oneLineAssessment);
  assert.equal(report.leadSynthesisId, 's1');
  assert.deepEqual(report.evidenceIds, ['e1']);
  assert.equal(report.executiveSummary, 'Summary');
});
