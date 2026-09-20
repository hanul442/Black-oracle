import assert from 'node:assert/strict';
import test from 'node:test';

import { planResearchRun } from './reportOrchestrator';

test('activation plan keeps specialist calls bounded', () => {
  const plan = planResearchRun({
    reportType: 'SECURITY',
    availableEvidenceDomains: ['fundamentals', 'valuation', 'price', 'volume', 'flows', 'event'],
    changedEvidenceDomains: ['event'],
    maxSpecialists: 3,
  });

  assert.equal(plan.expectedSpecialistCalls <= 3, true);
  assert.equal(plan.expectedLeadCalls, 1);
  assert.equal(plan.activation.lead.analystId, 'security_lead');
});

test('material Grade change preselects Red Team', () => {
  const plan = planResearchRun({
    reportType: 'SECURITY',
    availableEvidenceDomains: ['fundamentals', 'price'],
    materialGradeChange: true,
  });

  assert.equal(plan.redTeamPreselected, true);
});
