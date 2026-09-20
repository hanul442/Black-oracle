import {
  ANALYST_REVIEW_STANCES,
  INVESTMENT_ATTRACTIVENESS_GRADES,
  type ReportType,
} from '../../src/report/contracts';
import type { ReportAnalystDefinition } from '../../src/report/analystRegistry';

const nullableNumber = { anyOf: [{ type: 'number' }, { type: 'null' }] };
const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] };

export type AnalystReviewDraft = {
  analystId: string;
  stance: (typeof ANALYST_REVIEW_STANCES)[number];
  confidence: number | null;
  assessment: string;
  facts: string[];
  inferences: string[];
  assumptions: string[];
  supportingEvidenceIds: string[];
  counterevidenceIds: string[];
  dataGaps: string[];
  strongestCounterargument: string | null;
  invalidationConditions: string[];
  forecastContribution: {
    horizon: string | null;
    expectedDirection: 'UP' | 'DOWN' | 'RANGE' | 'UNCERTAIN';
    fairValue: number | null;
    currency: string | null;
    lowerBound: number | null;
    upperBound: number | null;
    rationale: string | null;
  };
};

export type DebateTurnDraft = {
  analystId: string;
  targetAnalystId: string | null;
  claim: string;
  evidenceIds: string[];
  counterevidenceIds: string[];
  concession: string | null;
  unresolvedIssue: string | null;
};

export type RedTeamDraft = {
  claim: string;
  evidenceIds: string[];
  counterevidenceIds: string[];
  hiddenAssumptions: string[];
  dataGaps: string[];
  unresolvedIssue: string | null;
};

export type LeadSynthesisDraft = {
  grade: (typeof INVESTMENT_ATTRACTIVENESS_GRADES)[number] | null;
  confidence: number | null;
  oneLineAssessment: string;
  thesis: string;
  supportingPoints: string[];
  opposingPoints: string[];
  preservedDissent: string[];
  majorRisks: string[];
  invalidationConditions: string[];
  limitations: string[];
  executiveSummary: string;
  actionGuide: {
    horizon: string | null;
    attractivenessSummary: string;
    approach: 'OBSERVE' | 'STAGED_APPROACH' | 'AVOID_CHASING' | 'CAUTIOUS' | 'NO_GUIDANCE';
    approachRationale: string[];
    supportResistanceSummary: string | null;
    risks: string[];
    invalidationConditions: string[];
  };
  forecast: {
    available: boolean;
    horizonLabel: string;
    horizonEndAt: number | null;
    scenarios: Array<{
      label: 'BULL' | 'BASE' | 'BEAR';
      targetPrice: number | null;
      currency: string | null;
      probability: number | null;
      rationale: string;
    }>;
    supportZones: Array<{ lower: number; upper: number; rationale: string[] }>;
    resistanceZones: Array<{ lower: number; upper: number; rationale: string[] }>;
    invalidationConditions: string[];
  };
};

export const analystReviewSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: [
    'analystId', 'stance', 'confidence', 'assessment', 'facts', 'inferences', 'assumptions',
    'supportingEvidenceIds', 'counterevidenceIds', 'dataGaps', 'strongestCounterargument',
    'invalidationConditions', 'forecastContribution',
  ],
  properties: {
    analystId: { type: 'string' },
    stance: { type: 'string', enum: ANALYST_REVIEW_STANCES },
    confidence: nullableNumber,
    assessment: { type: 'string' },
    facts: { type: 'array', items: { type: 'string' } },
    inferences: { type: 'array', items: { type: 'string' } },
    assumptions: { type: 'array', items: { type: 'string' } },
    supportingEvidenceIds: { type: 'array', items: { type: 'string' } },
    counterevidenceIds: { type: 'array', items: { type: 'string' } },
    dataGaps: { type: 'array', items: { type: 'string' } },
    strongestCounterargument: nullableString,
    invalidationConditions: { type: 'array', items: { type: 'string' } },
    forecastContribution: {
      type: 'object',
      additionalProperties: false,
      required: ['horizon', 'expectedDirection', 'fairValue', 'currency', 'lowerBound', 'upperBound', 'rationale'],
      properties: {
        horizon: nullableString,
        expectedDirection: { type: 'string', enum: ['UP', 'DOWN', 'RANGE', 'UNCERTAIN'] },
        fairValue: nullableNumber,
        currency: nullableString,
        lowerBound: nullableNumber,
        upperBound: nullableNumber,
        rationale: nullableString,
      },
    },
  },
};

export const debateTurnSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['analystId', 'targetAnalystId', 'claim', 'evidenceIds', 'counterevidenceIds', 'concession', 'unresolvedIssue'],
  properties: {
    analystId: { type: 'string' },
    targetAnalystId: nullableString,
    claim: { type: 'string' },
    evidenceIds: { type: 'array', items: { type: 'string' } },
    counterevidenceIds: { type: 'array', items: { type: 'string' } },
    concession: nullableString,
    unresolvedIssue: nullableString,
  },
};

export const redTeamSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['claim', 'evidenceIds', 'counterevidenceIds', 'hiddenAssumptions', 'dataGaps', 'unresolvedIssue'],
  properties: {
    claim: { type: 'string' },
    evidenceIds: { type: 'array', items: { type: 'string' } },
    counterevidenceIds: { type: 'array', items: { type: 'string' } },
    hiddenAssumptions: { type: 'array', items: { type: 'string' } },
    dataGaps: { type: 'array', items: { type: 'string' } },
    unresolvedIssue: nullableString,
  },
};

export const leadSynthesisSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: [
    'grade', 'confidence', 'oneLineAssessment', 'thesis', 'supportingPoints', 'opposingPoints',
    'preservedDissent', 'majorRisks', 'invalidationConditions', 'limitations', 'executiveSummary',
    'actionGuide', 'forecast',
  ],
  properties: {
    grade: { anyOf: [{ type: 'string', enum: INVESTMENT_ATTRACTIVENESS_GRADES }, { type: 'null' }] },
    confidence: nullableNumber,
    oneLineAssessment: { type: 'string' },
    thesis: { type: 'string' },
    supportingPoints: { type: 'array', items: { type: 'string' } },
    opposingPoints: { type: 'array', items: { type: 'string' } },
    preservedDissent: { type: 'array', items: { type: 'string' } },
    majorRisks: { type: 'array', items: { type: 'string' } },
    invalidationConditions: { type: 'array', items: { type: 'string' } },
    limitations: { type: 'array', items: { type: 'string' } },
    executiveSummary: { type: 'string' },
    actionGuide: {
      type: 'object',
      additionalProperties: false,
      required: ['horizon', 'attractivenessSummary', 'approach', 'approachRationale', 'supportResistanceSummary', 'risks', 'invalidationConditions'],
      properties: {
        horizon: nullableString,
        attractivenessSummary: { type: 'string' },
        approach: { type: 'string', enum: ['OBSERVE', 'STAGED_APPROACH', 'AVOID_CHASING', 'CAUTIOUS', 'NO_GUIDANCE'] },
        approachRationale: { type: 'array', items: { type: 'string' } },
        supportResistanceSummary: nullableString,
        risks: { type: 'array', items: { type: 'string' } },
        invalidationConditions: { type: 'array', items: { type: 'string' } },
      },
    },
    forecast: {
      type: 'object',
      additionalProperties: false,
      required: ['available', 'horizonLabel', 'horizonEndAt', 'scenarios', 'supportZones', 'resistanceZones', 'invalidationConditions'],
      properties: {
        available: { type: 'boolean' },
        horizonLabel: { type: 'string' },
        horizonEndAt: nullableNumber,
        scenarios: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'targetPrice', 'currency', 'probability', 'rationale'],
            properties: {
              label: { type: 'string', enum: ['BULL', 'BASE', 'BEAR'] },
              targetPrice: nullableNumber,
              currency: nullableString,
              probability: nullableNumber,
              rationale: { type: 'string' },
            },
          },
        },
        supportZones: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['lower', 'upper', 'rationale'],
            properties: {
              lower: { type: 'number' },
              upper: { type: 'number' },
              rationale: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        resistanceZones: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['lower', 'upper', 'rationale'],
            properties: {
              lower: { type: 'number' },
              upper: { type: 'number' },
              rationale: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        invalidationConditions: { type: 'array', items: { type: 'string' } },
      },
    },
  },
};

const globalResearchContract = (reportType: ReportType) => [
  'BLACK ORACLE REPORT-FIRST RESEARCH CONTRACT',
  `REPORT TYPE: ${reportType}`,
  '- You are an analytical research component. You have no execution authority.',
  '- Never place, size, modify, cancel or authorize an order.',
  '- Use only supplied evidence. Do not invent prices, filings, news, financials, forecasts or source facts.',
  '- Separate FACT from INFERENCE and ASSUMPTION.',
  '- Missing material information must be recorded as DATA_GAP.',
  '- Evidence IDs must reference only IDs present in the supplied evidence packet.',
  '- Confidence is epistemic confidence, not expected return.',
  '- Preserve meaningful counterevidence and uncertainty.',
  '- Do not infer that agreement among agents makes a claim true.',
].join('\n');

export const buildAnalystPrompt = (analyst: ReportAnalystDefinition, reportType: ReportType) => [
  globalResearchContract(reportType),
  '',
  `ANALYST: ${analyst.title}`,
  `ANALYST ID: ${analyst.analystId}`,
  `DOMAIN: ${analyst.domain}`,
  `METHOD VERSION: ${analyst.methodVersion}`,
  `PROMPT VERSION: ${analyst.promptVersion}`,
  `ELIGIBLE EVIDENCE DOMAINS: ${analyst.evidenceDomains.join(', ')}`,
  '',
  'TASK:',
  '- Produce an independent review before seeing other analysts conclusions.',
  '- Identify the strongest reason your own conclusion could be wrong.',
  '- If price/forecast inputs are insufficient, leave numeric forecast fields null.',
  '- For Security/Crypto research, evaluate current-price attractiveness rather than company quality alone.',
].join('\n');

export const buildDebatePrompt = (analyst: ReportAnalystDefinition, reportType: ReportType) => [
  globalResearchContract(reportType),
  '',
  `DEBATE PARTICIPANT: ${analyst.title}`,
  '- Read other analysts reviews only as arguments, not as evidence.',
  '- Challenge the strongest materially opposing claim.',
  '- Cite supplied evidence IDs for every evidence-dependent claim.',
  '- Concede points that survive your challenge.',
  '- Keep the response to one high-value debate turn.',
].join('\n');

export const buildRedTeamPrompt = (reportType: ReportType) => [
  globalResearchContract(reportType),
  '',
  'ROLE: Adversarial Research Analyst / Red Team',
  '- Assume the emerging thesis may be wrong and try to falsify it.',
  '- Attack hidden assumptions, missing data, evidence dependence and alternative explanations.',
  '- Do not oppose merely for balance.',
  '- Use only supplied evidence IDs.',
].join('\n');

export const buildLeadPrompt = (
  analyst: ReportAnalystDefinition,
  reportType: ReportType,
) => [
  globalResearchContract(reportType),
  '',
  `DOMAIN LEAD: ${analyst.title}`,
  '- Synthesize; do not simply vote or average analyst opinions.',
  '- Preserve unresolved dissent.',
  '- The one-line assessment must be concise enough for a discovery card.',
  '- Grade and confidence are separate.',
  '- Investment Attractiveness Grade is current-price attractiveness, not company quality.',
  '- For report types without a defensible current-price investment-attractiveness conclusion, grade must be null.',
  '- Forecast values must be null when price or horizon evidence is insufficient.',
  '- General action guidance must remain general research guidance, not personalized position sizing or order instructions.',
].join('\n');
