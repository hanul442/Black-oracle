import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COUNCIL_CONSTITUTION,
  PRIMARY_COUNCIL_PERSONAS,
  RED_TEAM_PERSONA,
  SPECIALIST_COUNCIL_PERSONAS,
  buildCouncilPersonaInstructions,
  resolveCouncilPersonas,
} from './councilConstitution';

test('Council v3 keeps deterministic Risk outside the AI Council', () => {
  assert.equal(PRIMARY_COUNCIL_PERSONAS.some((persona) => /risk/i.test(persona.title)), false);
  assert.equal(RED_TEAM_PERSONA.team, 'RED_TEAM');
});

test('Council v3 core team is always-on and role-separated', () => {
  assert.equal(PRIMARY_COUNCIL_PERSONAS.length, 4);
  assert.equal(PRIMARY_COUNCIL_PERSONAS.every((persona) => persona.alwaysOn), true);
  assert.equal(new Set(PRIMARY_COUNCIL_PERSONAS.map((persona) => persona.id)).size, 4);
  assert.equal(RED_TEAM_PERSONA.alwaysOn, true);
});

test('dynamic specialists are explicit, deduplicated, and unknown roles are ignored', () => {
  const resolved = resolveCouncilPersonas([
    'microstructure_flow',
    'macro_cross_asset',
    'microstructure_flow',
    'unknown_role',
  ]);

  assert.equal(resolved.length, PRIMARY_COUNCIL_PERSONAS.length + 2);
  assert.deepEqual(
    resolved.slice(-2).map((persona) => persona.id),
    ['microstructure_flow', 'macro_cross_asset'],
  );
});

test('persona prompts enforce evidence discipline, no-trade, and zero execution authority', () => {
  const prompt = buildCouncilPersonaInstructions(PRIMARY_COUNCIL_PERSONAS[0]);
  assert.match(prompt, /executionAuthority=false/);
  assert.match(prompt, /DATA_GAP/);
  assert.match(prompt, /Probability and confidence are separate/);
  assert.match(prompt, /NO_TRADE/);
  assert.match(prompt, /Do not use another Council member conclusion as evidence/);
});

test('constitution preserves the approved decision principles', () => {
  assert.ok(COUNCIL_CONSTITUTION.includes('Evidence over narrative.'));
  assert.ok(COUNCIL_CONSTITUTION.includes('Falsification before conviction.'));
  assert.ok(COUNCIL_CONSTITUTION.includes('Outcome over eloquence.'));
  assert.equal(SPECIALIST_COUNCIL_PERSONAS.every((persona) => !persona.alwaysOn), true);
});
