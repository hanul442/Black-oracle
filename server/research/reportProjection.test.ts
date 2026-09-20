import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReportCardProjection, gradeDistance, isMaterialGradeChange } from './reportProjection';
import type { ReportVersion } from '../../src/report/contracts';

const report = (version: number, grade: ReportVersion['grade'], publishedAt = 1000): ReportVersion => ({
  contractVersion: 1,
  reportId: 'security:005930',
  version,
  reportType: 'SECURITY',
  status: 'PUBLISHED',
  subject: {
    subjectId: 'security:005930',
    subjectType: 'SECURITY',
    canonicalSymbol: '005930',
    displayName: 'Samsung Electronics',
  },
  asOf: publishedAt,
  evidenceCutoff: publishedAt,
  createdAt: publishedAt,
  publishedAt,
  grade,
  confidence: 0.7,
  oneLineAssessment: 'Test assessment',
  executiveSummary: '',
  sectionKeys: [],
  evidenceIds: [],
  analystReviewIds: [],
  debateId: null,
  leadSynthesisId: null,
  forecastId: null,
  limitations: [],
});

test('grade distance is positive for an upgrade', () => {
  assert.equal((gradeDistance('BB', 'A+') ?? 0) > 0, true);
});

test('material Grade change threshold is configurable', () => {
  assert.equal(isMaterialGradeChange('A', 'A+', 1), true);
  assert.equal(isMaterialGradeChange('A', 'A+', 2), false);
});

test('report card keeps only concise discovery fields', () => {
  const card = buildReportCardProjection({
    current: report(2, 'A+', 2000),
    previous: report(1, 'BB', 1000),
    currentPrice: 123000,
    currency: 'KRW',
    now: 2500,
  });

  assert.equal(card.currentPrice, 123000);
  assert.equal(card.grade, 'A+');
  assert.equal(card.previousGrade, 'BB');
  assert.equal(card.oneLineAssessment, 'Test assessment');
  assert.equal(card.isMaterialGradeChange, true);
});
