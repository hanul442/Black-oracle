import assert from 'node:assert/strict';
import test from 'node:test';

import { projectPublishedReportForPlan, type PublishedReportArtifacts } from './reportViewProjection';

const artifacts: PublishedReportArtifacts = {
  report: {
    contractVersion: 1,
    reportId: 'r1',
    version: 1,
    reportType: 'SECURITY',
    status: 'PUBLISHED',
    subject: { subjectId: 's1', subjectType: 'SECURITY', displayName: 'Test' },
    asOf: 1,
    evidenceCutoff: 1,
    createdAt: 1,
    publishedAt: 1,
    grade: 'A+',
    confidence: 0.75,
    oneLineAssessment: 'One line.',
    executiveSummary: 'Paid detail.',
    sectionKeys: ['ANALYST_VIEWS', 'DEBATE', 'FORECAST'],
    evidenceIds: ['e1'],
    analystReviewIds: ['a1'],
    debateId: 'd1',
    leadSynthesisId: 'synth1',
    forecastId: 'f1',
    limitations: [],
  },
  analystReviews: [],
  debate: {
    debateId: 'd1',
    reportId: 'r1',
    reportVersion: 1,
    triggered: true,
    triggerReason: 'test',
    participantAnalystIds: ['a'],
    turns: [{
      turnId: 't1',
      round: 1,
      sequence: 1,
      analystId: 'a',
      claim: 'Debate opening claim',
      evidenceIds: ['e1'],
      counterevidenceIds: [],
      createdAt: 1,
    }],
    materialDisagreements: [],
    resolvedDisagreements: [],
    unresolvedDisagreements: [],
    summary: null,
    startedAt: 1,
    completedAt: 2,
  },
  synthesis: {
    synthesisId: 'synth1',
    reportId: 'r1',
    reportVersion: 1,
    leadAnalyst: { analystId: 'lead', role: 'Lead', domain: 'security', methodVersion: '1', promptVersion: '1' },
    asOf: 1,
    grade: 'A+',
    confidence: 0.75,
    oneLineAssessment: 'One line.',
    executiveSummary: 'Paid detail.',
    thesis: 'Lead conclusion',
    supportingPoints: [],
    opposingPoints: [],
    preservedDissent: ['Dissent'],
    majorRisks: [],
    invalidationConditions: [],
    limitations: [],
  },
  forecast: {
    forecastId: 'f1',
    reportId: 'r1',
    reportVersion: 1,
    publishedAt: 1,
    asOf: 1,
    horizonLabel: '3M',
    horizonEndAt: 2,
    scenarios: [{ label: 'BASE', targetPrice: 120, currency: 'KRW', probability: 0.5, rationale: '' }],
    supportZones: [],
    resistanceZones: [],
    invalidationConditions: [],
    status: 'ACTIVE',
  },
};

test('Core exposes preview but not full debate or forecast', () => {
  const view: any = projectPublishedReportForPlan(artifacts, 'CORE');
  assert.equal(view.grade, 'A+');
  assert.equal(view.debatePreview.claim, 'Debate opening claim');
  assert.equal(view.debate, undefined);
  assert.equal(view.forecast, undefined);
  assert.equal(view.paywall.forecast, true);
});

test('Plus exposes full debate and concise Lead conclusion but no full Report', () => {
  const view: any = projectPublishedReportForPlan(artifacts, 'PLUS');
  assert.equal(view.debate.debateId, 'd1');
  assert.equal(view.leadConclusion.thesis, 'Lead conclusion');
  assert.equal(view.fullReport, undefined);
  assert.equal(view.forecast, undefined);
});

test('Pro exposes full Report and expected-price Forecast', () => {
  const view: any = projectPublishedReportForPlan(artifacts, 'PRO');
  assert.equal(view.fullReport.executiveSummary, 'Paid detail.');
  assert.equal(view.forecast.forecastId, 'f1');
});
